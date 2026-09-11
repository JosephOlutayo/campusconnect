# Deploying CampusConnect

Read the **[Before you go public](#before-you-go-public)** section first. Some of
it is not optional.

---

## What has to be deployed

Two things:

| Piece | Needs | Suggested host |
| --- | --- | --- |
| The application | A JVM or container runtime, always-on (it holds WebSocket connections) | Render, Railway, Fly.io, Heroku |
| PostgreSQL | Managed database | Neon, Supabase, Railway, Render |

**It cannot go on Vercel.** Vercel runs serverless functions; this is a
long-lived JVM process holding STOMP WebSocket connections.

The pages and the API come from the same process, so there is no second origin,
no `CORS_ORIGINS` to keep in step, and no build-time WebSocket URL to get wrong.
Those three settings caused the first two failed deploys of this project.

---

## Environment variables

### API

| Variable | Required | Notes |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | **yes** | Must be `prod`. Turns off demo seeding and the H2 console, turns on Secure cookies. |
| `CAMPUSCONNECT_JWT_SECRET` | **yes** | `openssl rand -base64 48`. **The app refuses to start in prod without a real one** — the development default is published in this repository, so anyone could forge an admin session. |
| `DATABASE_URL` | one of two | `jdbc:postgresql://host:5432/dbname` — note the `jdbc:` prefix, which providers' connection strings omit. |
| `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_NAME` | one of two | Use these instead when the platform gives you the parts separately; the URL is composed for you. `DATABASE_PORT` defaults to 5432. |
| `DATABASE_USER` | **yes** | |
| `DATABASE_PASSWORD` | **yes** | |
| `CORS_ORIGINS` | no | Only needed if something on another origin calls the JSON API. The browser never does — pages and API share an origin. |
| `ADMIN_EMAIL` | **yes** | The first admin account. Created on first boot only if no admin exists. |
| `ADMIN_PASSWORD` | **yes** | 12+ characters; the app refuses a shorter one. This account can change everything. |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` | **yes** | SMTP for verification emails. **The prod profile refuses to start without a host** — students would wait forever for a link that was never sent. |
| `MAIL_OPTIONAL` | first deploy only | `true` lets it start with no mail server, for getting the site up before a sending domain exists. Links go to the log and nobody can earn the campus badge. Remove it once mail works. |
| `MAIL_FROM` | **yes** | e.g. `CampusConnect <no-reply@yourdomain.com>`. Needs SPF and DKIM on that domain or campus mail servers will bin it. |
| `APP_URL` | **yes** | The service's own public URL. Verification links are built from it, so a wrong value sends people to a dead link. |
| `PORT` | usually auto | Most platforms inject this. |
| `SECURE_COOKIES` | defaults true in prod | Leave alone unless you are deliberately serving over HTTP. |
| `FLYWAY_BASELINE` | first deploy only | `true` when pointing at a database Hibernate already created, so Flyway adopts the existing schema as V1. |
| `STRIPE_SECRET_KEY` | no | Setting it switches the gateway to Stripe — **which is not implemented yet**. See below. |

### Pages

| Variable | Required | Notes |
| --- | --- | --- |
| `CAMPUSCONNECT_APP_NAME` | no | Defaults to CampusConnect. Shown in the sidebar and page titles. |

---

## Try the production config locally first

`docker-compose.yml` runs Postgres + the application exactly as production does.
It is the cheapest way to catch a bad environment variable.

```bash
cp .env.docker.example .env.docker
# fill in CAMPUSCONNECT_JWT_SECRET, DATABASE_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose --env-file .env.docker up --build
```

Then open <http://localhost:8080>. If it works there, the same variables will
work on a real host.

Note this machine has no Docker installed — that command is for wherever you do
have it.

---

## Deploying, by platform

### Render (fewest manual steps — `render.yaml` does the provisioning)

`render.yaml` is a Blueprint describing both pieces, so Render creates the
database, wires its credentials in, and generates the JWT secret itself. Nothing
secret lives in the file.

1. Push this repository to GitHub.
2. Render Dashboard → **New → Blueprint** → pick the repository.
3. Render prompts for the values that cannot exist before the first deploy:
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `APP_URL` — the service's own public
   URL, e.g. `https://campusconnect.onrender.com`. You may need to deploy once,
   copy the assigned URL, set `APP_URL`, and redeploy.

Note that Render re-reads `render.yaml` when the Blueprint is synced, not on an
ordinary auto-deploy. Changing the file and pushing is not enough on its own.

`render.yaml` asks for the free plan everywhere. Two things to know:

- **A free Postgres instance is deleted after 30 days.** Everything in it goes
  with it. Move to a paid database before anyone's real bookings live there.
- Free web services sleep when idle, which makes the first request after a nap
  slow.

Fine for showing the app to people; not a footing for real users.

### Railway

1. Push this repository to GitHub.
2. New Project → Deploy from GitHub repo.
3. Add a **PostgreSQL** service.
4. Add a service with root directory `api/`; it uses `api/Dockerfile`. Set the
   variables above. `DATABASE_URL` may be given as a `postgres://` URI — the app
   converts that to JDBC form itself.

### Fly.io (deploys from this folder — no GitHub needed)

The only option here that does not require pushing to a Git host. `api/fly.toml`
is already written; the CLI is at `~/.fly/bin/flyctl`.

Fly asks for a payment card at signup even though a small app sits inside their
low-usage allowances.

```bash
export PATH="$HOME/.fly/bin:$PATH"
fly auth login                    # opens a browser

cd api
fly launch --copy-config --no-deploy
#   App names are globally unique, so you may be given a different one.

fly postgres create --name campusconnect-db --region dfw
fly postgres attach campusconnect-db
#   This sets DATABASE_URL to a postgres:// URI. The app converts that to the
#   jdbc: form itself — see DatabaseUrlNormalizer.

# Secrets never go in fly.toml, which is committed.
fly secrets set \
  CAMPUSCONNECT_JWT_SECRET="$(openssl rand -base64 48)" \
  ADMIN_EMAIL="you@example.com" \
  ADMIN_PASSWORD="at-least-twelve-characters"

fly deploy
#   Note the hostname it prints, then point verification links at it:
fly secrets set APP_URL="https://<the-hostname>"
```

Then open it, sign in with `ADMIN_EMAIL`, and add your campuses.

`min_machines_running = 0` lets the machine suspend when idle, which is cheap
but drops live messaging until someone wakes it; set it to `1` if that matters.
If the app is killed on startup with an out-of-memory error, raise `memory` in
`api/fly.toml` to `1gb`.

To ship a change afterwards: `fly deploy` from `api/`.

---

## Setting up your own campuses

Production creates no demo data. On first boot the app creates the service
categories and one administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and
nothing else — no universities, no providers.

That admin account is the way in, and it matters because of an ordering
constraint: **adding a university needs an admin, and signing up needs a
university.** Without the admin, a fresh deployment cannot be set up at all.
If you forget the variables the app still starts and logs exactly what to set.

Once it is running:

1. Sign in at `/login` with `ADMIN_EMAIL`.
2. **Admin → Universities → Add.** For each school, set its name, short name,
   slug, city, state, and its email domains as a comma-separated list
   (`pvamu.edu, student.pvamu.edu`). Domains are what grant the campus-verified
   badge, and they are stored per university — schools do not share a format.
3. **Admin → Categories** if you want to rename or add service types.
4. Providers can now sign up, pick their campus, and list services. Approve them
   under **Admin → Providers** (or leave auto-approve on).

Students get the campus-verified badge by confirming a link emailed to an
address on one of your domains — a matching domain alone is not enough, since
anyone can type one. Anyone else can still register, just without the badge.

With no `MAIL_HOST` set (local development), the app prints the verification
link to the API console instead of sending it, so the flow can be tested with
no email account.

### What is currently set up on the live deployment

Recorded here so it can be rebuilt by hand if the database is ever lost. It is
deliberately short, because almost nothing in that database is irreplaceable:
the categories and platform settings are recreated by `BootstrapRunner` on
startup, and the administrator is recreated from `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. The campus below is the only row somebody actually typed.

| Field | Value |
| --- | --- |
| Name | University of Texas at Dallas |
| Short name | UTD |
| Slug | ut-dallas |
| City / State | Richardson, TX |
| Email domains | utdallas.edu |

Re-add it under **Admin -> Universities -> Add**. Everything else on the live
site — providers, bookings, reviews — is still empty, so there is nothing else
to restore.

### Turning on real email

1. Create an account with a sending provider — Resend, Postmark and SES all
   speak plain SMTP, so any of them works without a code change.
2. Add your sending domain there and publish the **SPF and DKIM** DNS records
   it gives you. This is not optional: university mail systems are among the
   strictest, and unauthenticated mail to a `.edu` address is usually binned
   silently. That looks identical to the application being broken.
3. Set `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` and
   `MAIL_FROM` (the from-address must be on the domain you just authenticated).
4. Restart and check the log says `Mail: sending over SMTP via …`. If it says
   the links are printed to the log, the host did not take.

Locally, pass the same variables to `api/run-local.sh`.

## Before you go public

These are ordered by how much they matter.

### Blocking — do not take real bookings without these

1. **Payments do not move money.** The gateway is `MOCK`. A student can book, see
   a price and a fee split, and no card is ever charged. Launching like this means
   providers do unpaid work. Either finish the Stripe integration (the two marked
   points in `PaymentService`, plus Connect onboarding) or make it unmistakable in
   the UI that payment happens in person.
2. **The legal documents are unreviewed drafts.** Terms, privacy policy and
   community guidelines describe real product behaviour but have not been seen by
   a lawyer. You are running a marketplace where strangers meet in private homes.
3. **No rate limiting.** Login and booking are both unthrottled — credential
   stuffing and booking spam are trivial.

### Important — do soon after

4. ~~Switch to Flyway.~~ **Done.** The schema is built by the migrations in
   `api/src/main/resources/db/migration`, and production runs `ddl-auto:
   validate`, so a mismatch between the entities and the migrations fails the
   deploy instead of surfacing later as missing columns. Change the schema by
   adding a new `V<n>__name.sql`; never edit an applied one.

   Deploying onto a database Hibernate already built? Set `FLYWAY_BASELINE=true`
   for the first deploy so Flyway adopts it at V1 rather than trying to recreate
   it, then remove the variable.
5. **WebSocket subscribe authorisation.** Sends and REST reads check
   participation; `SUBSCRIBE` does not. A determined user could subscribe to a
   conversation topic they are not part of. Needs a `ChannelInterceptor` on CONNECT.
6. **Refresh tokens.** A 30-day access token with no revocation is blunt. Today,
   suspending a user does not invalidate their existing token until it expires.
7. **Backups.** Turn on automated backups wherever the database lives.

### Worth knowing

8. Images are generated gradients, not uploads.
9. SMS and push are not wired to a provider; in-app notifications only. Email
   is wired, but is used solely for address verification — not for booking
   reminders or receipts.
10. The message thread refreshes on send rather than streaming. Messages are
    still broadcast over STOMP, so a live client can be added without changing
    how they are stored.
11. Availability assumes one timezone.
12. `/actuator/health` is public for platform health checks; nothing else is exposed.

---

## After the first deploy, check these

- Sign up with a brand new email — proves the database is writable.
- Sign in and send a message; reload and confirm it is there.
- Follow a verification link and confirm it lands on `/verify-email` and says
  the address is confirmed. A wrong `APP_URL` sends people to a dead link.
- Open `/admin` as a non-admin account and confirm it is refused.
- Book something, then confirm the exact address appears only after confirmation.
- Confirm `https://your-api/h2-console` is **not** reachable.
- Confirm no `admin@campusconnect.dev` account exists. If one does, the prod
  profile was not active and demo data was seeded — rotate the JWT secret and
  wipe the database.
