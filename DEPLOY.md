# Deploying CampusConnect

Read the **[Before you go public](#before-you-go-public)** section first. Some of
it is not optional.

---

## What has to be deployed

Three things, and they are not all the same kind of thing:

| Piece | Needs | Suggested host |
| --- | --- | --- |
| Java API | A JVM or container runtime, always-on (it holds WebSocket connections) | Railway, Render, Fly.io, Heroku |
| Next.js frontend | Node runtime | Vercel, Railway, Render |
| PostgreSQL | Managed database | Neon, Supabase, Railway, Render |

**The API cannot go on Vercel.** Vercel runs serverless functions; this API is a
long-lived JVM process holding STOMP WebSocket connections. Frontend on Vercel +
API on Railway/Render/Fly is a normal split, and the two only need to know each
other's URLs.

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
| `CORS_ORIGINS` | **yes** | Your frontend's public HTTPS origin, e.g. `https://campusconnect.app`. No trailing slash. |
| `PORT` | usually auto | Most platforms inject this. |
| `SECURE_COOKIES` | defaults true in prod | Leave alone unless you are deliberately serving over HTTP. |
| `STRIPE_SECRET_KEY` | no | Setting it switches the gateway to Stripe — **which is not implemented yet**. See below. |

### Frontend

| Variable | Required | Notes |
| --- | --- | --- |
| `API_BASE_URL` | **yes** | Where the *server* reaches the API. Can be an internal address, with or without a scheme — `http://` is assumed for a bare `host:port`. |
| `NEXT_PUBLIC_WS_URL` | **yes** | Where the *browser* reaches the WebSocket, e.g. `https://api.example.com/ws`. Baked in at build time, so it must be set as a **build** variable, not a runtime one. |
| `NEXT_PUBLIC_APP_NAME` | no | Defaults to CampusConnect. |

The `NEXT_PUBLIC_WS_URL` build-time detail is the single most common way to get a
working-looking deploy where live messaging silently never connects.

---

## Try the production config locally first

`docker-compose.yml` runs Postgres + API + frontend exactly as production does.
It is the cheapest way to catch a bad environment variable.

```bash
cp .env.docker.example .env.docker
# fill in CAMPUSCONNECT_JWT_SECRET and DATABASE_PASSWORD
docker compose --env-file .env.docker up --build
```

Then open <http://localhost:3000>. If it works there, the same variables will
work on a real host.

Note this machine has no Docker installed — that command is for wherever you do
have it.

---

## Deploying, by platform

### Railway (simplest — everything in one project)

1. Push this repository to GitHub.
2. New Project → Deploy from GitHub repo.
3. Add a **PostgreSQL** service. Railway sets `PGHOST`/`PGUSER`/etc.
4. Add a service for the **API**, root directory `api/`. It will use `api/Dockerfile`.
   Set the variables above. `DATABASE_URL` must be rewritten into JDBC form:
   `jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}`
5. Add a service for the **frontend**, root directory `/`. Set `API_BASE_URL` to
   the API service's internal URL and `NEXT_PUBLIC_WS_URL` to its public URL + `/ws`.
6. Set `CORS_ORIGINS` on the API to the frontend's public URL, and redeploy the API.

### Render (fewest manual steps — `render.yaml` does the provisioning)

`render.yaml` is a Blueprint describing all three pieces, so Render creates the
database, wires its credentials into the API, and generates the JWT secret
itself. Nothing secret lives in the file.

1. Push this repository to GitHub.
2. Render Dashboard → **New → Blueprint** → pick the repository.
3. Render prompts for the two values that cannot exist before the first deploy:
   - `CORS_ORIGINS` on the API → the web service's URL, e.g. `https://campusconnect-web.onrender.com`
   - `NEXT_PUBLIC_WS_URL` on the web → the API's URL + `/ws`, e.g. `https://campusconnect-api.onrender.com/ws`
   You may need to deploy once, copy the assigned URLs, set these, and redeploy.

Note the free plan sleeps after inactivity, which drops WebSocket connections
and makes the first request slow. Fine for a demo, not for real users.

### Vercel (frontend) + Render (API)

1. **Render** → New Web Service → Docker → root `api/`. Add a Render PostgreSQL
   instance and set the variables above.
2. **Vercel** → import the repository, framework Next.js. Set `API_BASE_URL` and
   `NEXT_PUBLIC_WS_URL` to the Render URLs.
3. Set `CORS_ORIGINS` on Render to the Vercel domain.

### Fly.io

`fly launch` in `api/` and again at the root. Attach Fly Postgres to the API.
Fly keeps the machine warm, which suits the WebSocket well.

---

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

4. **Switch to Flyway.** The prod profile currently runs `ddl-auto: update`, which
   is fine on an empty database and increasingly not fine once it holds bookings.
   Generate a baseline migration from the live schema, then set `DDL_AUTO=validate`.
5. **WebSocket subscribe authorisation.** Sends and REST reads check
   participation; `SUBSCRIBE` does not. A determined user could subscribe to a
   conversation topic they are not part of. Needs a `ChannelInterceptor` on CONNECT.
6. **Refresh tokens.** A 30-day access token with no revocation is blunt. Today,
   suspending a user does not invalidate their existing token until it expires.
7. **Backups.** Turn on automated backups wherever the database lives.

### Worth knowing

8. Images are generated gradients, not uploads.
9. Email, SMS and push are not wired to a provider — notifications are in-app only.
10. Availability assumes one timezone.
11. `/actuator/health` is public for platform health checks; nothing else is exposed.

---

## After the first deploy, check these

- Sign up with a brand new email — proves the database is writable.
- Sign in and open a conversation. **Look for the green "Live" dot.** If it says
  Offline, `NEXT_PUBLIC_WS_URL` was wrong at build time.
- Book something, then confirm the exact address appears only after confirmation.
- Confirm `https://your-api/h2-console` is **not** reachable.
- Confirm no `admin@campusconnect.dev` account exists. If one does, the prod
  profile was not active and demo data was seeded — rotate the JWT secret and
  wipe the database.
