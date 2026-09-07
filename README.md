# CampusConnect

A college-campus services marketplace. Students discover, book and review services
offered by other students and local providers around their campus — barbers,
braiders, nail techs, tutors, photographers, trainers, detailers, tailors, DJs and
more.

The product name lives in one place (`campusconnect.app-name`), so renaming it is
a config change, not a refactor.

---

## Architecture

One Java process serves everything:

```
browser ──► Spring Boot (:8080) ──► H2 / Postgres
             │  Thymeleaf pages
             │  REST + STOMP under /api and /ws
             └─ same origin, so the session cookie is first-party
                and there is no CORS anywhere
```

Pages are rendered server-side by controllers in `view/`, which call the same
services the REST controllers in `web/` call — no HTTP hop between the two, since
they are the same process. The REST API stays because it is genuinely used: by
the STOMP client, and by anything that wants JSON.

JavaScript is progressive enhancement only (`static/js/app.js`: confirm dialogs,
a double-submit guard, the tab bar). Every page works with it switched off.

| Layer | Choice |
| --- | --- |
| Application | Java 21, Spring Boot 3.3, Spring Data JPA (Hibernate), Spring Security + JWT, STOMP/WebSocket |
| Pages | Thymeleaf templates, hand-written CSS |
| Database | H2 file mode locally, PostgreSQL via `DATABASE_URL` |
| Payments | Stripe Connect architecture, mock gateway active |

Full backend documentation is in **[api/README.md](api/README.md)** — the slot
engine, the locking strategy, the payment model and the JWT flow are all
explained there.

---

## Run it locally

```bash
cd api
./run-local.sh
```

Open <http://localhost:8080>.

There is nothing else to install: the app runs against an embedded H2 database,
and a portable JDK 21 + Maven live in `C:\Users\josep\tools` (no system-wide
install, no admin rights used).

### First run on an empty database

Production seeds no demo data. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` and the
first administrator is created at startup — without one, nobody can add a
university, and without a university nobody can sign up at all.

### Scripts

| Command | Purpose |
| --- | --- |
| `./run-local.sh` (in `api/`) | Run the app |
| `mvn spring-boot:run -Dspring-boot.run.arguments=--seed=reset` | Wipe and reseed demo data |
| `mvn test` (in `api/`) | Java unit tests |
| `./go-live.sh` | Serve this machine to the internet through one Cloudflare tunnel |

---

## What is where

```
api/
  src/main/java/app/campusconnect/
    domain/                 18 JPA entities
    repository/             Spring Data interfaces
    service/                SlotEngine, BookingService, SearchService, ...
    security/               JWT filter, Spring Security config
    web/                    REST controllers + DTOs
    view/                   the page controllers
    seed/                   demo data
  src/main/resources/
    templates/              Thymeleaf pages
      provider/  admin/  legal/
    static/css  static/js   hand-written CSS, progressive-enhancement JS
```

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

Postgres is picked up automatically from `DATABASE_URL`.

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

**Email verification is real.** The campus badge is granted only when a link sent
to that address has been followed. Matching the domain alone proved forgeable —
you can sign up with an address you do not own.

---

## Environment

See [api/README.md](api/README.md). The ones that matter in production:

| Variable | Purpose |
| --- | --- |
| `CAMPUSCONNECT_JWT_SECRET` | The app refuses to start under `prod` with the development default |
| `DATABASE_URL` | A `postgres://` URI is converted to JDBC form at startup |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first administrator, created on an empty database |
| `APP_URL` | The public origin verification links point at |
| `MAIL_*` | SMTP. Without it, links are printed to the log instead of sent |

### API keys you would need before launch

None to run or demo this. Before taking real money or sending real notifications:

- **Stripe** (secret, publishable, webhook secret, Connect enabled) — payments and payouts
- **An email provider** (Resend, Postmark or SES) plus a sending domain
- **Twilio or similar** — SMS reminders, if you want them
- **Cloudinary / Supabase Storage / S3** — real photo uploads
- **Mapbox or Google Maps** — only for a real map; distances work today without one

---

## Verification

- `mvn test` — Java unit tests over the slot engine and the fee split.
- An end-to-end script driven over real HTTP: signup, login, JWT, search,
  availability, booking, sequential **and concurrent** double-booking prevention,
  provider booking management, reviews, messaging, favourites, provider
  self-service, reporting, admin moderation and logout.

Bugs found by running it rather than reading it: `LazyInitializationException`
across the API (DTO mapping outside the transaction), bookings failing because
`REQUIRES_NEW` returns a detached entity, Spring Security returning unparseable
empty 401 bodies, `/api/stats/campus` not being public so the home page 500'd for
signed-out visitors, a Postgres-only search failure from an untyped null
parameter, and the HTML admin console requiring only *a* signed-in account rather
than an administrator.

---

## What is deliberately not built yet

- **Real payments.** Architecture complete, mock gateway active, Stripe SDK calls
  unimplemented. Provider Connect onboarding does not exist.
- **Live message updates in the browser.** Messages are stored and broadcast over
  STOMP, but the server-rendered thread refreshes on send rather than streaming.
- **Email / SMS / push fan-out.** `NotificationService` writes in-app rows;
  verification email is the one thing that actually sends.
- **WebSocket subscribe-time authorisation.** Sends and REST reads are checked;
  locking down `SUBSCRIBE` needs a `ChannelInterceptor` on the CONNECT frame.
- **Real image uploads.** Portfolio images render deterministic gradients.
- **Google sign-in.** Columns exist; the OAuth flow does not.
- **Timezones.** Availability is interpreted in the server's local zone, correct
  while the platform serves one region.
- **Search at scale.** Indexed filtering in SQL, ranking in memory over a bounded
  set. Move to Postgres `tsvector`/`pg_trgm` when the catalogue outgrows a campus.
- **Rate limiting** on auth and booking endpoints.
- **Refresh tokens** — a 30-day access token is a blunt instrument.
- **Legal documents** are working drafts describing real product behaviour. Have
  a lawyer review them before launch.
