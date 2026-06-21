# Venue Flow

QR-based event attendance system for Russian House — Phase 1.

**Stack:** Node.js API (Render) · PostgreSQL (Neon) · React frontends (Netlify)

## Apps

| App | Path | Port (dev) | Purpose |
|---|---|---|---|
| **API** | `packages/api` | 3000 | REST backend |
| **Back Office** | `apps/backoffice` | 5173 | Admin & organizer portal |
| **Scanner** | `apps/scanner` | 5174 | Volunteer QR scanner |

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (local Docker or [Neon](https://neon.tech) account)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Environment variables live in **three places**:

| File | Variables | Used by |
|------|-----------|---------|
| `.env` (project root) | `DATABASE_URL`, `JWT_SECRET`, `PORT` | API + database commands |
| `apps/backoffice/.env` | `VITE_API_URL` | Back Office frontend |
| `apps/scanner/.env` | `VITE_API_URL` | Scanner frontend |

Copy the example and fill in your Neon URL:

```bash
cp .env.example .env
```

**Root `.env` example:**

```env
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=change-me-to-a-random-32-char-string
PORT=3000
```

Use Neon’s **pooled** connection string (`-pooler` in the hostname). The API and DB packages load this file automatically from the project root.

**Frontend `.env` files** (create if missing):

```env
# apps/backoffice/.env
VITE_API_URL=http://localhost:3000

# apps/scanner/.env
VITE_API_URL=http://localhost:3000
```

### 3. Start local PostgreSQL (optional)

```bash
docker compose up -d
# Then set DATABASE_URL=postgresql://venueflow:venueflow@localhost:5432/venueflow
```

### 4. Run database migrations & seed

```bash
pnpm db:push      # Push schema to DB (dev)
pnpm db:seed      # Create default admin/organizer/volunteer accounts
```

### 5. Start all services

```bash
pnpm dev
```

Or individually:

```bash
pnpm dev:api
pnpm dev:backoffice
pnpm dev:scanner
```

### Default login credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@russianhouse.com | admin123 |
| Organizer | organizer@russianhouse.com | organizer123 |
| Volunteer | volunteer@russianhouse.com | volunteer123 |

Use the **Back Office** app (port 5173) for Admin and Organizer. Use the **Scanner** app (port 5174) for Volunteers.

---

## How It Works (Phase 1 workflow)

Phase 1 does **not** assign events to a specific organizer. Admin and Organizer share the same Back Office capabilities within one organization — both can create events, register attendees, and issue volunteer PINs.

```mermaid
flowchart LR
  A[Admin or Organizer] -->|Create event| B[Back Office]
  B -->|Add attendees + QR| C[Attendee list]
  A -->|Optional: temp PIN| D[Volunteer account]
  D -->|Login| E[Scanner app]
  C -->|Show QR at door| E
  E -->|Scan| F[Check-in recorded]
```

### Recommended test walkthrough

1. **Back Office** — log in as `admin@russianhouse.com` (or `organizer@russianhouse.com`).
2. **Create an event** — Events → New Event (name, date, QR validity days).
3. **Add attendees** — open the event → fill in name/email → Generate QR. Each attendee gets a unique ticket QR.
4. **Set up a volunteer** (pick one):
   - **Temporary PIN** (event-scoped): on the event page → create volunteer PIN → share the 6-digit PIN with door staff.
   - **Permanent account**: use `volunteer@russianhouse.com` / `volunteer123` (can scan any event in the org).
5. **Scanner app** — log in as volunteer (password or PIN tab).
6. **Scan** — point the camera at the attendee QR (or enter ticket ID manually). Green = checked in; red = duplicate, expired, or invalid.
7. **Export** (optional) — Back Office → event → download attendance CSV.

### Role summary

| Role | App | Can do |
|------|-----|--------|
| **Admin** | Back Office | Everything an Organizer can, plus create permanent volunteer accounts |
| **Organizer** | Back Office | Create events, add attendees, generate QRs, create temp volunteer PINs, export CSV |
| **Volunteer** | Scanner | Scan QRs for check-in (temp PIN volunteers are limited to one event) |

**Note:** “Admin creates event → assigns to Organizer” is a common real-world process, but it is **not built yet**. Today, either Admin or Organizer can run steps 2–4 directly. Event-to-organizer assignment is planned for a later phase.

---

## Deployment

### Database — Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string (`?sslmode=require`)
3. Use this as `DATABASE_URL`

Run migrations against Neon (reads `DATABASE_URL` from root `.env`):

```bash
pnpm db:push
pnpm db:seed
```

Or pass the URL inline:

```bash
DATABASE_URL="your-neon-url" pnpm db:push
DATABASE_URL="your-neon-url" pnpm db:seed
```

### API — Render

1. Connect this repo to [Render](https://render.com)
2. Use the included `render.yaml` blueprint, or create a **Web Service** manually:
   - **Build command:** `pnpm install && pnpm --filter @venue-flow/db build && pnpm --filter @venue-flow/shared build && pnpm --filter @venue-flow/api build`
   - **Start command:** `pnpm --filter @venue-flow/api start`
   - **Pre-deploy command:** `pnpm --filter @venue-flow/db migrate`
3. Set environment variables:
   - `DATABASE_URL` — Neon pooled connection string
   - `JWT_SECRET` — random 32+ char string
   - `CORS_ORIGINS` — your Netlify URLs, comma-separated (no trailing slash)
   - `NODE_ENV` — `production`

Example `CORS_ORIGINS`:

```
https://venue-flow-backoffice.netlify.app,https://venue-flow-scanner.netlify.app
```

### Frontends — Netlify

Deploy **two separate Netlify sites** from this monorepo.

#### Back Office site

| Setting | Value |
|---|---|
| Base directory | *(repo root)* |
| Build command | `pnpm install && pnpm --filter @venue-flow/backoffice build` |
| Publish directory | `apps/backoffice/dist` |
| Environment variable | `VITE_API_URL=https://your-api.onrender.com` |

#### Scanner site

| Setting | Value |
|---|---|
| Base directory | *(repo root)* |
| Build command | `pnpm install && pnpm --filter @venue-flow/scanner build` |
| Publish directory | `apps/scanner/dist` |
| Environment variable | `VITE_API_URL=https://your-api.onrender.com` |

Both sites need SPA redirects (included in each app's `netlify.toml`).

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v1/auth/login` | Public | Login (password or PIN) |
| POST | `/v1/events` | Admin/Organizer | Create event |
| GET | `/v1/events` | Admin/Organizer | List events |
| GET | `/v1/events/:id` | Admin/Organizer | Event details |
| POST | `/v1/events/:id/attendees` | Admin/Organizer | Add attendee + QR |
| GET | `/v1/events/:id/attendees` | Admin/Organizer | List attendees |
| POST | `/v1/events/:id/volunteers` | Admin/Organizer | Create temp volunteer PIN |
| POST | `/v1/users/volunteers` | Admin | Create permanent volunteer |
| POST | `/v1/scanner/validate` | Volunteer | Scan & validate QR |
| GET | `/v1/events/:id/attendance.csv` | Admin/Organizer | Export CSV |
| GET | `/health` | Public | Health check |

---

## Project Structure

```
venue-flow/
├── apps/
│   ├── backoffice/     # Admin/Organizer React app → Netlify
│   └── scanner/        # Volunteer scanner app → Netlify
├── packages/
│   ├── api/            # Fastify REST API → Render
│   ├── db/             # Drizzle schema + migrations → Neon
│   └── shared/         # Shared types & validation
├── render.yaml         # Render deployment blueprint
├── docker-compose.yml  # Local PostgreSQL
└── .env.example
```

---

## Phase 1 Features

- Event creation with configurable QR validity window
- Manual attendee registration with QR code generation (Admin or Organizer)
- Temporary volunteer PIN accounts scoped to one event
- Mobile scanner with camera + manual ticket ID fallback
- Duplicate scan blocking (atomic DB update)
- Expired QR detection
- CSV attendance export with scan/no-show status

## Out of Scope (Phase 2+)

Event-to-organizer assignment, bulk CSV import, offline mode, email QR delivery, self-registration forms, multi-tenant SaaS.
