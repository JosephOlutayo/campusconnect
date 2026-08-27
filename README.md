# CampusConnect

A college-campus services marketplace. Students discover, book and review services
offered by other students and local providers around their campus — barbers,
braiders, nail techs, tutors, photographers, trainers, detailers, tailors, DJs and
more.

The product name lives in one place (`NEXT_PUBLIC_APP_NAME`), so renaming it is an
env change, not a refactor.

---

## Run it locally

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. No database server to install — local development
runs on SQLite.

### Demo accounts

Password for all of them: `password123`

| Account | Email | What it shows |
| --- | --- | --- |
| Student | `student@campusconnect.dev` | Bookings, saved providers, messages, a completed appointment waiting for a review |
| Provider | `marcus@utdallas.edu` | Campus Cuts — instant-booking provider dashboard |
| Provider | `tia@utdallas.edu` | Braids by Tia — manual booking approval, so requests queue up |
| Admin | `admin@campusconnect.dev` | Moderation console, marketplace fee, campuses |

The login screen has one-tap buttons for each.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:seed` | Wipe and reseed demo data |
| `npm run db:reset` | Reset migrations, then reseed |
| `npm run db:studio` | Prisma Studio |

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript | Server components keep data fetching next to the markup that needs it |
| Styling | Tailwind CSS v4 | Design tokens live in `globals.css` under `@theme` |
| Database | Prisma 6 + SQLite (dev) | Zero setup; the schema is written to move to Postgres unchanged |
| Auth | Custom session: `jose` (HS256 JWT in an httpOnly cookie) + `bcryptjs` | Small, dependency-light and easy for a solo developer to reason about |
| Validation | Zod | One schema per endpoint in `src/lib/validation.ts` |
| Payments | Stripe Connect architecture, mock gateway today | Full money model with no fabricated credentials |
| Images | Deterministic gradient placeholders | No external image host needed; swap for Cloudinary by filling one `url` column |

### Why SQLite, and how to move to Postgres

The brief asked for PostgreSQL. There is no Postgres server on this machine, and
requiring one would have meant shipping something I could not actually run and
test. So local dev uses SQLite and the schema is deliberately Postgres-portable:

- no native enums — string columns plus TypeScript union types in `src/lib/constants.ts`
- no scalar lists — comma-joined strings via `parseList` / `serializeList`
- no `Decimal` — every money value is an integer number of cents

To switch:

1. Set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at your server.
3. `npx prisma migrate dev`.

Two things to revisit on Postgres, both flagged in the code:

- `src/lib/search.ts` relies on SQLite's `LIKE` being case-insensitive for ASCII.
  On Postgres, add `mode: "insensitive"` (or move to `tsvector` / `pg_trgm`).
- `src/lib/booking.ts` relies on SQLite serialising writers for its overlap check.
  On Postgres, run that transaction at `SERIALIZABLE` or add an exclusion
  constraint on a `tstzrange`.

---

## Database

Sixteen models. Relationships in brief:

```
University ─┬─< UniversityEmailDomain
            ├─< User ──── ProviderProfile ─┬─< Service >─── Category
            └─< ProviderProfile            ├─< AvailabilityRule
                                           ├─< TimeOff
                                           ├─< PortfolioImage
                                           ├─< Promotion
                                           └─< Payout

Appointment ── User (customer), ProviderProfile, Service
            ├── Payment (1:1)
            └── Review (1:1) ─< ReviewImage

Conversation ── User (customer) + ProviderProfile ─< Message
Favorite · Notification · Report · Block · PlatformSetting
```

Points worth knowing:

- **Money is integer cents everywhere.** No floats in the ledger.
- **Appointments snapshot their price and fee split.** Changing a service price or
  the marketplace fee never rewrites history. There is a test for this.
- **`ProviderProfile.ratingAvg` / `ratingCount` are denormalised** for fast sorting
  and recomputed from visible reviews on every write that can change them
  (`recomputeProviderRating`).
- **`Appointment.blockEndAt`** is `endAt` plus the provider's buffer. All overlap
  checks use it, so turnaround time is built into the data rather than
  recalculated at every call site.
- Indexes cover university, category, provider, `startAt`, status and the
  composite pairs the list screens actually filter on.

---

## How authentication works

1. `POST /api/auth/signup` or `/login` verifies credentials with bcrypt.
2. A JWT (`{ sub: userId }`, HS256, 30 days) is signed with `AUTH_SECRET` and set as
   an httpOnly, SameSite=Lax cookie named `cc_session`.
3. `getSessionUser()` (`src/lib/auth.ts`) verifies the cookie and loads the user.
   It is wrapped in React's `cache()`, so many components can call it and only one
   query runs per request.
4. Page guards: `requireUser`, `requireRole`, `requireProvider`, `requireAdmin`.
   API guards: `apiUser`, `apiProvider`, `apiAdmin` in `src/lib/guards.ts`.
   The admin layout guards every `/admin/*` route in one place.

**University email verification.** Allowed domains are rows in
`UniversityEmailDomain`, never hardcoded — universities do not share a convention
(`utdallas.edu`, `mavs.uta.edu`, `my.unt.edu`). Signing up with an address whose
domain maps to your selected campus grants the verified-student badge immediately.
Changing campus re-evaluates the badge rather than letting it drift.

`src/lib/verification.ts` already issues single-use tokens for email verification.
Because no mail provider is configured, the token is returned to the caller instead
of being sent. Wire up Resend/SES/Postmark and only that one function changes.

Google sign-in is not implemented. `User.authProvider` and `User.googleId` exist so
it can be added without a migration.

---

## How booking works

The engine is `src/lib/availability.ts` and `src/lib/booking.ts`.

Slot generation, from a provider's weekly `AvailabilityRule` rows:

1. Walk each window for that weekday on a 15-minute grid.
2. Reject any slot that would end after the window closes.
3. Reject anything inside the provider's minimum notice, or past their maximum
   booking window.
4. Reject overlaps with `TimeOff`.
5. Reject overlaps with any `PENDING`/`CONFIRMED` appointment, comparing against
   `blockEndAt` so buffers are respected.

`computeDaySlots` is pure — no database access — so the single-day path, the
calendar-dots path and the bulk "next available for 12 search results" path all
share one implementation of the rules. Search resolves next-availability for the
whole result set in three queries rather than N+1.

**Double booking cannot happen.** The UI only offers free slots, and the API
re-checks before writing, but the authoritative guard runs *inside* the
transaction immediately before the insert: any blocking appointment overlapping
`[startAt, blockEndAt)` aborts the whole thing with a 409. The flow test asserts
this by having a second account attempt the exact slot a first account just took.

Statuses: `PENDING → CONFIRMED → COMPLETED`, plus `CANCELLED` and `NO_SHOW`.
Providers choose instant booking or manual approval per business.

---

## How payments work

The model is Stripe Connect **destination charges**:

```
customer card → platform Stripe account → transfer to provider
                    (keeps application_fee_amount)
```

A $40 service at a 10% fee: customer pays $40, provider receives $36, platform
keeps $4. The percentage is admin-configurable and stored per appointment at
booking time.

`src/lib/payments.ts` exposes `authorizePayment`, `capturePayment` and
`refundPayment`. Authorisation happens at booking, capture at completion, refund on
cancellation. Every field recorded (amount, application fee, transfer amount,
external id, capture/refund timestamps) maps one-to-one onto a Stripe
PaymentIntent.

Right now the gateway is `MOCK`: it runs the identical state machine in the
database. **No fake production credentials exist anywhere in this codebase.**
Setting `STRIPE_SECRET_KEY` flips `activeGateway()` to `STRIPE`; the SDK calls then
need implementing at the two marked points in that file. Nothing else changes —
not the schema, not the callers, not the UI.

---

## Environment variables

Copy `.env.example` to `.env`. Only the first two are required.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` for SQLite, or a Postgres URL |
| `AUTH_SECRET` | yes | 32+ random chars. `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_NAME` | no | Product name, defaults to CampusConnect |
| `PLATFORM_FEE_PERCENT` | no | Starting marketplace fee; admin UI overrides it |
| `STRIPE_SECRET_KEY` | no | Switches the gateway from mock to Stripe |
| `STRIPE_WEBHOOK_SECRET` | no | Needed for real payment confirmation |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | Client-side Stripe |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Reserved for Google sign-in |

### API keys you would need before launch

None to run or demo this. Before taking real money or sending real notifications:

- **Stripe** (secret, publishable, webhook secret, Connect enabled) — payments and payouts
- **An email provider** (Resend, Postmark or SES) — verification and booking emails
- **Twilio or similar** — SMS reminders, if you want them
- **Cloudinary / Supabase Storage / S3** — real photo uploads
- **Mapbox or Google Maps** — only if you want a real map; distances work today without one

---

## Project layout

```
prisma/
  schema.prisma          16 models, Postgres-portable
  seed.ts                demo data
src/
  app/
    (main)/              student-facing app (home, explore, providers, appointments, messages…)
    (auth)/              login and signup
    provider/            provider workspace (dashboard, calendar, services, availability, earnings…)
    admin/               moderation console
    api/                 REST endpoints
  components/
    ui/                  primitives (Button, Avatar, Modal, Stars, Icon…)
    shell/               app shell, sidebar, bottom nav
    booking/ providers/ provider/ admin/ …
  lib/
    availability.ts      slot engine (pure core + batch loader)
    booking.ts           the single write path for appointments
    payments.ts          gateway abstraction
    search.ts            filters, ranking, fuzzy matching
    time.ts              all wall-clock maths, in one file
    auth.ts guards.ts    session and route protection
```

---

## What is deliberately not built yet

Honest list, so nothing here is a surprise:

- **Real payments.** Architecture complete, mock gateway active, Stripe SDK calls
  unimplemented. Provider Connect onboarding does not exist.
- **Email / SMS / push delivery.** `notify()` is the single fan-out point and writes
  in-app notifications today. Booking reminders need a scheduled job.
- **Real image uploads.** Portfolio and review images render deterministic
  gradients. `PortfolioImage.url` is already preferred when set.
- **Google sign-in.** Columns exist; the OAuth flow does not.
- **Timezones.** Availability is interpreted in the server's local timezone, which
  is correct while the platform serves one region. Add `timezone` to `University`
  and swap the two constructors in `src/lib/time.ts` — no other file does date
  arithmetic by hand.
- **Search at scale.** In-memory ranking over a bounded query set. Fine for a
  campus; move to `tsvector`/`pg_trgm` when the catalogue grows.
- **Message realtime.** Threads poll every 6 seconds while the tab is visible.
  One effect to replace with SSE or Pusher.
- **Rate limiting** on auth and booking endpoints.
- **Legal documents** are working drafts that describe real product behaviour. Have
  a lawyer review them before launch.
- **Automated test suite.** Flows are verified by an end-to-end script rather than
  unit tests; `computeDaySlots` and `splitFee` are pure and the obvious first
  targets for real tests.

---

## Verification

`npm run typecheck` and `npm run lint` are both clean. A 60-assertion end-to-end
script exercised signup, login, search, availability, booking, double-booking
prevention, provider booking management, reviews, messaging, favourites, provider
self-service, reporting, admin moderation and logout against a running server —
all passing, including that a fee change does not alter existing bookings and that
suspending a provider removes them from search.
