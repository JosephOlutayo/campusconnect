# CampusConnect

A college-campus services marketplace. Students discover, book and review services
offered by other students and local providers around their campus — barbers,
braiders, nail techs, tutors, photographers, trainers, detailers, tailors, DJs and
more.

The product name lives in one place (`NEXT_PUBLIC_APP_NAME`), so renaming it is an
env change, not a refactor.

---

## Architecture

Two processes, one application:

```
browser ──► Next.js (:3100) ──► Java Spring Boot API (:8080) ──► H2 / Postgres
             │  React UI            REST + STOMP
             │  /api/[...path]
             └─ proxies every API call so the session cookie stays first-party
                and there is no CORS anywhere
```

The **only** exception to the proxy is the WebSocket, which connects straight to
the Java server — Next.js route handlers cannot proxy an upgrade, and the STOMP
endpoint allows the frontend origin explicitly.

Server components call the API directly (no proxy hop) via `src/lib/api.ts`,
forwarding the browser's `cc_token` cookie so a server-rendered page sees the same
user the browser does.

| Layer | Choice |
| --- | --- |
| Backend | Java 21, Spring Boot 3.3, Spring Data JPA (Hibernate), Spring Security + JWT, STOMP/WebSocket |
| Database | H2 file mode locally, PostgreSQL via the `postgres` profile |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Payments | Stripe Connect architecture, mock gateway active |

Full backend documentation is in **[api/README.md](api/README.md)** — the slot
engine, the locking strategy, the payment model and the JWT flow are all
explained there.

---

## Run it locally

Start the API first — the frontend reads everything from it.

**Terminal 1 — the API** (port 8080):

```bash
cd api
JAVA_HOME=/c/Users/josep/tools/jdk-21 PATH="$JAVA_HOME/bin:/c/Users/josep/tools/maven/bin:$PATH" mvn spring-boot:run
```

**Terminal 2 — the frontend** (port 3100):

```bash
npm install
npm run dev -- -p 3100
```

Open <http://localhost:3100>.

There is nothing else to install: the API seeds itself on first run against an
embedded H2 database, and a portable JDK 21 + Maven live in
`C:\Users\josep\tools` (no system-wide install, no admin rights used).

### Demo accounts

Password for all of them: `password123`

| Account | Email | What it shows |
| --- | --- | --- |
| Student | `student@campusconnect.dev` | Bookings, saved providers, live messages, a review waiting to be written |
| Provider | `marcus@utdallas.edu` | Campus Cuts — instant-booking provider dashboard |
| Provider | `tia@utdallas.edu` | Braids by Tia — manual approval, so requests queue up |
| Admin | `admin@campusconnect.dev` | Moderation console, marketplace fee, campuses |

The login screen has one-tap buttons for each.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `mvn spring-boot:run` (in `api/`) | API |
| `mvn spring-boot:run -Dspring-boot.run.arguments=--seed=reset` | Wipe and reseed |
| `mvn test` (in `api/`) | Java unit tests |

---

## What is where

```
api/                        Java Spring Boot backend (see api/README.md)
  src/main/java/app/campusconnect/
    domain/                 18 JPA entities
    repository/             Spring Data interfaces
    service/                SlotEngine, BookingService, SearchService, ...
    security/               JWT filter, Spring Security config
    web/                    REST controllers + DTOs
    seed/                   demo data
src/
  app/
    api/[...path]/          the proxy to Java — the only route handler left
    (main)/                 student app
    (auth)/                 login and signup
    provider/               provider workspace
    admin/                  moderation console
  components/               UI — unchanged by the backend swap
  lib/
    api.ts                  server-side API client + session
    types.ts                TypeScript mirrors of the Java DTOs
    guards.ts               page-level access guards
    time.ts money.ts geo.ts avatar.ts    pure formatting helpers
```

The UI components did not change when the backend moved from TypeScript to Java.
What changed is everything underneath them: `lib/api.ts` replaced direct database
access, and `lib/types.ts` mirrors the Java DTOs.

---

## Data model

Eighteen entities. The ones that carry the real rules:

- **Money is integer cents everywhere.** No floats in the ledger.
- **`Booking` snapshots its price and fee split.** Changing a service price or the
  marketplace fee never rewrites history. There is a test for this.
- **`Booking.blockEndAt`** is `endAt` plus the provider's buffer. Every overlap
  check compares against it, so turnaround time lives in the data.
- **`Review` has a one-to-one on `Booking`.** A review cannot exist without a
  completed booking — enforced structurally, not just in a service method.
- **`ProviderProfile.ratingAvg`** is denormalised for sorting and recomputed from
  visible reviews on every write that can change it.

Switching to PostgreSQL is a profile change:

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=postgres
```

---

## The parts worth reading

**Double booking cannot happen.** `BookingService.create` takes a pessimistic
write lock on the provider row, then runs the overlap check while holding it, at
`REQUIRES_NEW` + `SERIALIZABLE`. Verified by firing four simultaneous requests at
one slot: exactly one wins, and at least one loser gets past the pre-flight check
and is stopped by the in-transaction check — which is the case the lock exists for.

**The slot engine is pure.** `SlotEngine` has no Spring, no database and no clock
of its own, so the day view, the calendar dots and the bulk "next available for a
page of results" all share one implementation. 14 unit tests pin the rules down.

**Reviews are earned.** The only way to post one is a COMPLETED booking that
belongs to you and has not been reviewed.

**Addresses stay private.** A provider's exact address is released only to the
customer who booked, and only once the booking is CONFIRMED. The rule lives in the
DTO mapper so no controller can forget it.

**Live messaging.** Messages are persisted first, then broadcast over STOMP — a
dropped socket costs a live update, never a message.

---

## Environment

Frontend (`.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:8080` | Where the Java API lives |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:8080/ws` | STOMP endpoint for the browser |
| `NEXT_PUBLIC_APP_NAME` | CampusConnect | Product name |

API — see [api/README.md](api/README.md). The one that matters in production is
`CAMPUSCONNECT_JWT_SECRET`.

### API keys you would need before launch

None to run or demo this. Before taking real money or sending real notifications:

- **Stripe** (secret, publishable, webhook secret, Connect enabled) — payments and payouts
- **An email provider** (Resend, Postmark or SES) — verification and booking emails
- **Twilio or similar** — SMS reminders, if you want them
- **Cloudinary / Supabase Storage / S3** — real photo uploads
- **Mapbox or Google Maps** — only for a real map; distances work today without one

---

## Verification

- `mvn test` — 23 Java unit tests over the slot engine and the fee split.
- `npm run typecheck` and `npm run lint` — both clean.
- A **77-assertion end-to-end script** driven over real HTTP **through the
  Next.js proxy**, so it exercises the browser's actual path: signup, login, JWT,
  search, availability, booking, sequential **and concurrent** double-booking
  prevention, provider booking management, reviews, messaging, favourites,
  provider self-service, reporting, admin moderation and logout. All passing.
- All 41 pages render 200 as student, provider and admin.
- Live messaging verified by sending a message from outside the browser and
  watching it arrive with no refresh.

Bugs found by running it rather than reading it: `LazyInitializationException`
across the API (DTO mapping outside the transaction), bookings failing because
`REQUIRES_NEW` returns a detached entity, Spring Security returning unparseable
empty 401 bodies, `/api/stats/campus` not being public so the home page 500'd for
signed-out visitors, and a seed bug that made every provider look like it joined
this week.

---

## What is deliberately not built yet

- **Real payments.** Architecture complete, mock gateway active, Stripe SDK calls
  unimplemented. Provider Connect onboarding does not exist.
- **Email / SMS / push.** `NotificationService` is the single fan-out point and
  writes in-app rows today.
- **WebSocket subscribe-time authorisation.** Sends and REST reads are checked;
  locking down `SUBSCRIBE` needs a `ChannelInterceptor` on the CONNECT frame.
- **Real image uploads.** Portfolio images render deterministic gradients.
- **Google sign-in.** Columns exist; the OAuth flow does not.
- **Flyway migrations** — the API currently runs `ddl-auto: update`. Switch to
  `validate` before anything real ships.
- **Timezones.** Availability is interpreted in the server's local zone, correct
  while the platform serves one region.
- **Search at scale.** Indexed filtering in SQL, ranking in memory over a bounded
  set. Move to Postgres `tsvector`/`pg_trgm` when the catalogue outgrows a campus.
- **Rate limiting** on auth and booking endpoints.
- **Refresh tokens** — a 30-day access token is a blunt instrument.
- **Legal documents** are working drafts describing real product behaviour. Have
  a lawyer review them before launch.
