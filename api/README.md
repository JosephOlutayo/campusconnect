# CampusConnect (Java / Spring Boot)

The whole application: Java 21, Spring Boot 3.3, Spring Data JPA (Hibernate),
Spring Security + JWT, Thymeleaf for the pages, and STOMP over WebSocket.

One process serves both. The pages are rendered by controllers in `view/`,
which call the same services as the REST controllers in `web/` — no HTTP hop
between them, since they are the same process. The REST API stays because it is
genuinely used, by the STOMP client and by anything that wants JSON; its
envelope is `{ok, data, error}`.

---

## Run it

There is **no system-wide JDK install required**. The toolchain used to build
this lives under `C:\Users\josep\tools`:

```bash
export JAVA_HOME=/c/Users/josep/tools/jdk-21
export PATH="$JAVA_HOME/bin:/c/Users/josep/tools/maven/bin:$PATH"

cd api
mvn spring-boot:run
```

The API comes up on <http://localhost:8080> and seeds itself on first run.

| What | Where |
| --- | --- |
| API | http://localhost:8080/api |
| H2 console | http://localhost:8080/h2-console (JDBC URL `jdbc:h2:file:./data/campusconnect`, user `sa`, no password) |
| WebSocket | ws://localhost:8080/ws (SockJS + STOMP) |

Useful flags:

```bash
mvn spring-boot:run -Dspring-boot.run.arguments=--seed=reset   # wipe and reseed
mvn spring-boot:run -Dspring-boot.run.profiles=postgres        # use Postgres instead of H2
mvn test                                                        # unit tests
```

### Demo accounts

Password for all of them: `password123`

| Account | Email |
| --- | --- |
| Student (bookings, saves, messages, a review waiting to be written) | `student@campusconnect.dev` |
| Provider — Campus Cuts, instant booking | `marcus@utdallas.edu` |
| Provider — Braids by Tia, manual approval | `tia@utdallas.edu` |
| Admin | `admin@campusconnect.dev` |

Seed contents: 6 universities, 16 categories, 20 providers, 55 services, ~200
bookings with history, ~140 reviews, plus conversations, promotions, time off and
two open moderation reports.

---

## Database

H2 in file mode for local development — zero setup, and the data survives a
restart like a real database. JPA is the abstraction that makes Postgres a
config change rather than a rewrite:

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=postgres
# DATABASE_URL / DATABASE_USER / DATABASE_PASSWORD
```

`ddl-auto: update` generates the schema from the entities. **Before anything
real ships, switch that to `validate` and manage change with Flyway** — auto-DDL
is fine for an MVP and dangerous for a live database.

### Entities

`University` · `User` · `ProviderProfile` · `Category` · `ServiceOffering` ·
`AvailabilityRule` · `TimeOff` · `Booking` · `Review` · `Conversation` ·
`Message` · `Payment` · `Promotion` · `Favorite` · `Notification` · `Report` ·
`PortfolioImage` · `PlatformSetting`

Things worth knowing:

- **Money is integer cents everywhere.** No floats in the ledger.
- **`Booking` snapshots its price and fee split.** Changing a service price or
  the marketplace fee never rewrites history. Verified by test.
- **`Booking.blockEndAt`** is `endAt` plus the provider's buffer. Every overlap
  check compares against it, so turnaround time lives in the data rather than
  being re-derived at each call site.
- **`ProviderProfile.ratingAvg`/`ratingCount`** are denormalised for sorting and
  recomputed from visible reviews on every write that can change them.
- The entity is named `ServiceOffering`, not `Service`, so it never collides with
  Spring's `@Service` stereotype.

---

## How double booking is prevented

Two students can press Confirm on the same 5:30 slot in the same second. The UI
only offers free slots and the controller pre-checks — but neither is a
guarantee, because both can pass before either writes.

The guarantee is in `BookingService.create`, and it has two parts:

1. **A pessimistic write lock on the provider row** (`SELECT ... FOR UPDATE` via
   `findByIdForUpdate`), taken as the *first* statement in the transaction. Every
   booking for a given provider serialises there. We lock the provider rather
   than the slot because slots are computed, not stored — there is no slot row to
   lock.
2. **The overlap check runs while that lock is held.** The loser of the race only
   reaches it after the winner has committed, so it sees the new booking and
   aborts with `409`.

The method runs at `REQUIRES_NEW` + `SERIALIZABLE` so it stays correct even when
a caller already has a longer read transaction open.

This is verified, not assumed: the flow test fires **four simultaneous requests
at one slot**. Exactly one wins. In the recorded run, two losers were caught by
the pre-flight check and **one got past it and was stopped by the in-transaction
overlap check** — which is precisely the case the lock exists for.

---

## The slot engine

`SlotEngine` is pure and static: no Spring, no database, no clock of its own.
The single-day path, the calendar-dots path and the bulk "next available for a
page of search results" path all share one implementation of the rules.

A candidate slot survives only if it clears five gates: it fits inside a working
window for that weekday; the day is within the advance-booking horizon; it starts
after `now + minimum notice`; it misses all time off; and it misses every
`PENDING`/`CONFIRMED` booking, buffer included.

Intervals are half-open `[start, end)`, which is why an appointment ending at
17:00 and one starting at 17:00 do not collide — no off-by-one-minute fudging
anywhere. 14 unit tests pin this down (`SlotEngineTest`).

Search resolves next-availability for a whole page in **three queries**
(`AvailabilityService.nextAvailableBatch`) rather than N+1.

---

## Authentication

1. `POST /api/auth/signup` or `/login` verifies credentials with BCrypt.
2. A JWT (`sub`, `email`, `role`; HS256; 30 days) is returned **twice**: in the
   body for API clients that hold it themselves, and as an **httpOnly `cc_token`
   cookie** so browser JavaScript can never read it.
3. `JwtAuthFilter` accepts either transport and populates the SecurityContext. An
   expired or tampered token is treated as anonymous, not an error — the route's
   own rules then decide whether that is acceptable.
4. Public routes: auth, search, provider profiles, categories, universities,
   availability. `/api/admin/**` requires `ROLE_ADMIN`. Everything else requires
   a session.
5. 401 and 403 return the same `{ok, error}` envelope as every other response.

**University email verification** uses the `university_email_domains` collection
table — domains are data, never hardcoded, because universities do not share a
convention (`utdallas.edu`, `mavs.uta.edu`, `my.unt.edu`). Signing up with an
address whose domain maps to the selected campus grants the verified-student
badge immediately; changing campus re-evaluates it rather than letting it drift.

---

## Payments

Stripe Connect **destination charges**:

```
customer card -> platform Stripe account -> transfer to provider
                    (platform keeps application_fee_amount)
```

$40 at a 10% fee: customer pays $40, provider receives $36, platform keeps $4.
The percentage is admin-configurable and snapshotted per booking.

`PaymentService` exposes `authorize` (at booking), `capture` (at completion) and
`refund` (at cancellation). Every recorded field maps one-to-one onto a Stripe
PaymentIntent.

The gateway is `MOCK` and runs the identical state machine in the database.
**No fabricated production credentials exist in this codebase.** Setting
`STRIPE_SECRET_KEY` flips `activeGateway()` to `STRIPE`; the SDK calls then need
implementing at the two marked points in that file. Nothing else changes.

---

## Live messaging

STOMP over WebSocket at `/ws` (SockJS fallback enabled).

- Client subscribes to `/topic/conversations/{id}`
- Client sends to `/app/conversations/{id}/send`
- REST equivalents exist at `/api/conversations/{id}/messages`

Messages are **persisted first, then broadcast** — a dropped socket costs a live
update, never a message. Both transports funnel through the same service method,
so participation checks cannot diverge between them.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CAMPUSCONNECT_JWT_SECRET` | dev value | 32+ chars. **Must be set in production.** |
| `campusconnect.platform-fee-percent` | 10 | Starting fee; the admin console overrides it at runtime |
| `campusconnect.cors-origins` | localhost:3000,3100 | Only for clients on another origin; the browser is same-origin |
| `campusconnect.seed` | true | Set false to disable demo seeding |
| `STRIPE_SECRET_KEY` | _(unset)_ | Switches the gateway from mock to Stripe |
| `DATABASE_URL` / `DATABASE_USER` / `DATABASE_PASSWORD` | — | Used by the `postgres` profile |

---

## Verification

- `mvn test` — 23 unit tests over the slot engine and the fee split, all passing.
- A 77-assertion end-to-end script drives the running API over real HTTP with
  cookie jars: signup, login, JWT, search, availability, booking, sequential
  **and concurrent** double-booking prevention, provider booking management,
  reviews, messaging, favourites, provider self-service, reporting, admin
  moderation and logout. All passing.

Three real bugs were found and fixed by running it, not by reading it:

1. `LazyInitializationException` throughout — DTO mapping ran after the
   transaction closed (`open-in-view: false`). Fixed by scoping read-only
   transactions around the read paths rather than re-enabling open-in-view.
2. Bookings failed because `create` runs at `REQUIRES_NEW`, so the entity it
   returned was detached from an already-closed persistence context. Fixed by
   re-reading the booking in the request's own transaction before mapping.
3. Spring Security returned empty bodies on 401/403, which a client parsing
   `{ok, ...}` on every call cannot read.

---

## Not built yet

- **Real Stripe calls** and Connect onboarding. Architecture complete, mock gateway active.
- **Email / SMS / push.** `NotificationService` is the single fan-out point and
  writes in-app rows today.
- **WebSocket subscribe-time authorisation.** Sends are checked (the service
  verifies participation before persisting) and REST reads are checked, but
  locking down `SUBSCRIBE` needs a `ChannelInterceptor` on the CONNECT frame.
  Flagged rather than pretended-complete.
- **Flyway migrations** — currently `ddl-auto: update`.
- **Timezones.** Availability is interpreted in the server's local zone, correct
  while the platform serves one region. Add `timezone` to `University` and the
  slot engine takes it as a parameter.
- **Search at scale.** Indexed filtering in SQL, ranking in memory over a bounded
  set. Move to Postgres `tsvector`/`pg_trgm` when the catalogue outgrows a campus.
- **Rate limiting** on auth and booking endpoints.
- **Refresh tokens** — a 30-day access token is a blunt instrument.
