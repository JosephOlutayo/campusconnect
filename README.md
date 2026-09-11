# CampusConnect

**Live: https://campusconnect-6gth.onrender.com**

A college-campus services marketplace. Students at Texas universities discover,
book and review services offered by other students and local providers around
their campus — barbers, braiders, nail techs, tutors, photographers, trainers,
detailers, tailors, DJs and more.

> The live site runs on a free hosting plan that sleeps when idle, so the first
> request after a quiet spell takes around a minute to wake up. After that it is
> immediate.

---

## Architecture

One Java process serves everything:

```
browser ──► Spring Boot (:8080) ──► H2 / PostgreSQL
             │  Thymeleaf pages
             │  REST + STOMP under /api and /ws
             └─ same origin, so the session cookie is first-party
                and there is no CORS anywhere
```

Pages are rendered server-side by controllers in `view/`, which call the same
services as the REST controllers in `web/` — no HTTP hop between them, since
they are the same process. The REST API remains because it is genuinely used: by
the STOMP client, and by anything that wants JSON.

JavaScript is progressive enhancement only (~80 lines: confirm dialogs, a
double-submit guard, the mobile tab bar). Every page works with it switched off.

| Layer | Choice |
| --- | --- |
| Application | Java 21, Spring Boot 3.3, Spring Data JPA (Hibernate), Spring Security + JWT |
| Pages | Thymeleaf templates, hand-written CSS |
| Database | H2 file mode locally, PostgreSQL in production |
| Live messaging | STOMP over WebSocket |
| Payments | Stripe Connect architecture, mock gateway active — no money moves |

---

## What the project contains

| | Count |
| --- | --- |
| JPA entities | 27 |
| Service classes | 20 |
| Page controllers | 10 |
| REST controllers | 10 |
| Thymeleaf templates | 35 |
| Java | ~11,500 lines |

### For students

- **Search and filtering** — by campus, category, price, rating, location mode and
  free-text phrase. "math tutor" matches the Tutoring category because categories
  carry their own keywords, so synonyms are data rather than hardcoded rules.
- **Booking** — pick a service, pick a day, choose from real open slots computed
  from the provider's weekly hours, existing bookings and time off.
- **Appointments** — upcoming and past, with cancellation.
- **Messaging** — a thread per provider, stored server-side.
- **Reviews** — only on a completed booking, once, and it moves the provider's
  public rating immediately.
- **Saved providers**, notifications, and a campus-verified badge earned by
  confirming a link emailed to a university address.

### For providers

- **Onboarding** — business details, location mode, first service and a default
  working week created in one transaction, so a half-built business cannot exist.
- **Dashboard** — pending requests, upcoming appointments, headline figures.
- **Bookings** — confirm, decline, complete or mark a no-show.
- **Services** — add and remove listings with prices and durations.
- **Opening hours** — a weekly schedule; slots are derived from it.
- **Earnings** — completed work, by week and all time.

### For administrators

- **Campuses** — add, hide or delete universities and their email domains.
- **People** — search, suspend, or delete an account that has no history.
- **Providers** — approve, suspend, and grant the verified badge.
- **Categories**, **reports**, a read-only **booking list**, and marketplace
  settings (platform fee, provider auto-approval).

---

## Run it locally

```bash
cd api
./run-local.sh
```

Open <http://localhost:8080>.

Nothing else to install: the app runs against an embedded H2 database, and a
portable JDK 21 + Maven live outside the project (no system-wide install).

### First run on an empty database

Production seeds no demo data. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` and the
first administrator is created at startup — without one, nobody can add a
university, and without a university nobody can sign up at all.

### Commands

| Command | Purpose |
| --- | --- |
| `./run-local.sh` (in `api/`) | Run the app |
| `mvn spring-boot:run -Dspring-boot.run.arguments=--seed=reset` | Wipe and reseed demo data |
| `mvn test` (in `api/`) | Unit tests |
| `./scripts/go-live.sh` | Serve this machine to the internet through one Cloudflare tunnel |

---

## Repository layout

```
api/                        the application
  src/main/java/app/campusconnect/
    domain/                 JPA entities
    repository/             Spring Data interfaces
    service/                SlotEngine, BookingService, SearchService, ...
    security/               JWT filter, Spring Security config
    web/                    REST controllers + DTOs
    view/                   page controllers
    seed/                   demo data and first-run bootstrap
  src/main/resources/
    templates/              Thymeleaf pages (provider/, admin/, legal/)
    static/                 hand-written CSS, progressive-enhancement JS
    db/migration/           Flyway migrations
deploy/                     docker-compose and its env template
docs/DEPLOY.md              deployment, environment variables, launch checklist
scripts/go-live.sh          expose a local instance through a tunnel
render.yaml                 Render Blueprint (must stay at the repository root)
```

---

## Data model

27 entities. The ones carrying the real rules:

- **Money is integer cents everywhere.** No floats in the ledger.
- **`Booking` snapshots its price and fee split.** Changing a service price or the
  marketplace fee never rewrites history. There is a test for this.
- **`Booking.blockEndAt`** is `endAt` plus the provider's buffer. Every overlap
  check compares against it, so turnaround time lives in the data.
- **`Review` has a one-to-one on `Booking`.** A review cannot exist without a
  completed booking — enforced structurally, not just in a service method.
- **`ProviderProfile.ratingAvg`** is denormalised for sorting and recomputed from
  visible reviews on every write that can change it.

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
customer who booked, and only once the booking is CONFIRMED. The rule lives in
the DTO mapper so no controller can forget it.

**Email verification is real.** The campus badge is granted only when a link sent
to that address has been followed. Matching the domain alone proved forgeable —
you can sign up with an address you do not own.

---

## Verification

- `mvn test` — 23 unit tests over the slot engine and the fee split.
- A 31-check end-to-end journey driven over real HTTP through the pages a browser
  uses: search, slot picker, booking, concurrent double-booking prevention, the
  request reaching the provider, completion, address privacy, reviews posted once
  and refused twice, messaging both ways, and role boundaries.

Bugs found by running it rather than reading it: `LazyInitializationException`
from DTO mapping outside the transaction, bookings failing because `REQUIRES_NEW`
returns a detached entity, Spring Security returning unparseable empty 401
bodies, a PostgreSQL-only search failure from an untyped null parameter, and the
HTML admin console requiring only *a* signed-in account rather than an
administrator.

---

## Deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for environment variables, platform
walkthroughs and the pre-launch checklist. The essentials in production:

| Variable | Purpose |
| --- | --- |
| `CAMPUSCONNECT_JWT_SECRET` | The app refuses to start under `prod` with the development default |
| `DATABASE_URL` | A `postgres://` URI is converted to JDBC form at startup |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first administrator, created on an empty database |
| `APP_URL` | The public origin verification links point at |
| `MAIL_*` | SMTP. Without it, links are printed to the log instead of sent |
