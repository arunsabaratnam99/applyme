# ApplyMe

A ToS-compliant, privacy-first job matcher and assisted-apply webapp for **Canada-based software and business roles** — full-time and internships.

## Features

- **Job discovery** from Ashby, Lever, Greenhouse, Job Bank Canada, LinkedIn Jobs API, Indeed Publisher API, and curated GitHub internship repos
- **Smart matching** with rules-first scoring, watchlist boosts, and reasons explanations
- **Three-path apply system**:
  - Path A (silent): email apply + native ATS API apply fires automatically in background
  - Path B (one-tap queue): form-based jobs queue up; browser extension autofills on one tap
  - Path C (tier-1): large/important companies require draft review before applying
- **Company peer discovery**: watch Kinaxis → system suggests Descartes, Tecsys, etc.
- **Application detail view**: see exactly what was submitted, full timeline, expiry tracking
- **Dark + light mode**, PWA support, web push notifications

## Stack

| Layer | Tech |
|---|---|
| Web | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui |
| API | Cloudflare Workers, Hono router |
| DB | Postgres (Neon in prod / Docker locally), Drizzle ORM |
| Storage | Cloudflare R2 (private bucket, presigned URLs) |
| Auth | OAuth 2.0 PKCE — Google + GitHub |
| Push | Web Push (VAPID) |
| Email | Resend (feature-flagged, default off) |
| Extension | Chrome/Firefox Manifest V3 |
| Observability | Sentry (feature-flagged, default on) |

---

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker + Docker Compose (for local Postgres)
- A Cloudflare account (Workers + R2)
- Google and GitHub OAuth apps
- (Optional) LinkedIn Partner API access, Indeed Publisher account

---

## Local Dev Setup

### 1. Clone and install

```bash
git clone https://github.com/yourname/applyme
cd applyme
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

**Required for local dev:**
- `DATABASE_URL` — set to `postgresql://applyme:applyme@localhost:5432/applyme`
- `JWT_SECRET` — any 32+ char random string
- `OAUTH_GOOGLE_CLIENT_ID` + `OAUTH_GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `OAUTH_GITHUB_CLIENT_ID` + `OAUTH_GITHUB_CLIENT_SECRET` — from GitHub Developer Settings
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — generate with:

```bash
npx web-push generate-vapid-keys
```

### 3. Start Postgres

```bash
docker-compose up -d
```

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Start development servers

```bash
# Terminal 1 — API worker
pnpm dev:api

# Terminal 2 — Web app
pnpm dev:web
```

Web app: http://localhost:3000  
API worker: http://localhost:8787

---

## Database Commands

```bash
pnpm db:generate    # Generate a new migration from schema changes
pnpm db:migrate     # Run pending migrations
pnpm db:studio      # Open Drizzle Studio (DB browser)
```

---

## OAuth Setup

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `http://localhost:8787/auth/google/callback`

### GitHub
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL: `http://localhost:8787/auth/github/callback`

---

## Optional: LinkedIn Jobs API

Requires [LinkedIn Partner Program](https://business.linkedin.com/marketing-solutions/partner-program) approval (free).  
Set `LINKEDIN_ENABLED=true` + `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` in `.env`.

## Optional: Indeed Publisher API

Requires a free [Indeed Publisher account](https://ads.indeed.com/jobroll/xmlfeed).  
Set `INDEED_ENABLED=true` + `INDEED_PUBLISHER_ID` in `.env`.

---

## Browser Extension (autofill)

```bash
cd apps/extension
pnpm build
```

Load the `dist/` folder as an unpacked extension in Chrome (`chrome://extensions`) or Firefox.

---

## Deployment

### API (Cloudflare Workers)

```bash
cd apps/api
pnpm deploy
```

### Web (Vercel)

```bash
cd apps/web
pnpm build
# Deploy via Vercel CLI or connect GitHub repo
```

### Database (Neon)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string to `DATABASE_URL` in your production env
3. Run `pnpm db:migrate`

---

## Project Structure

```
applyme/
├── apps/
│   ├── web/          # Next.js 14 App Router + PWA
│   ├── api/          # Cloudflare Worker + Hono router
│   └── extension/    # Chrome/Firefox Manifest V3 extension
├── packages/
│   ├── db/           # Drizzle ORM schema + migrations
│   └── shared/       # Shared types, Zod schemas, scoring, classifiers
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .env.example
```

---

## Tests

```bash
pnpm test           # Run all tests
pnpm test --filter @applyme/shared   # Shared package only
pnpm test --filter @applyme/api      # API only
```
