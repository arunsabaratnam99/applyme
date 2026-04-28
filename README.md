# ApplyMe

> Your personal job application assistant for Canadian tech roles

ApplyMe helps you find and apply to software and business jobs in Canada — faster and smarter. It aggregates opportunities from multiple sources, auto-fills applications with your profile, and tracks everything in one place.

## Why ApplyMe?

Applying to jobs is tedious. You copy-paste the same information into dozens of forms, lose track of where you've applied, and miss opportunities because you didn't see them in time.

**ApplyMe solves this:**
- **Finds jobs for you** — Aggregates from LinkedIn, Indeed, Greenhouse, Lever, Job Bank Canada, and more
- **Applies automatically** — Pre-fills forms with your resume data, submits with one click
- **Tracks everything** — See what you applied to, when, and what you submitted
- **Smart matching** — Jobs ranked by fit with clear explanations
- **Beautiful interface** — Clean design, dark mode, works on mobile

## Key Features

### Job Discovery
- Pulls from **Ashby, Lever, Greenhouse, Job Bank Canada, LinkedIn, Indeed**, and curated GitHub repos
- Filters by **location, job type** (full-time/internship), and **category** (software/business)
- **Company peer discovery** — Watch one company, get similar suggestions (e.g., watch Shopify → see Faire, Wealthsimple)

### Smart Application System
Three ways to apply, depending on the job:

1. **Instant Apply** — Email or API-based jobs apply automatically in the background (with your approval)
2. **One-Click Autofill** — Form-based jobs queue up; browser extension fills them with one tap
3. **Draft Review** — Important companies (Tier 1) require you to review before submitting

### Application Tracking
- Full timeline of every application
- See exactly what was submitted (answers, resume version, cover letter)
- Expiry tracking for time-sensitive applications

### Modern UI
- Dark + light mode
- PWA support (install as an app)
- Web push notifications for new matches

---

## Quick Start

Want to run ApplyMe locally? Here's the fastest path:

```bash
# 1. Clone and install
git clone https://github.com/yourusername/applyme
cd applyme
pnpm install

# 2. Start Postgres
docker-compose up -d

# 3. Set up environment (see detailed setup below)
cp .env.example .env
# Edit .env with your credentials

# 4. Run migrations
pnpm db:migrate

# 5. Start dev servers
pnpm dev:web    # Terminal 1 → http://localhost:3000
pnpm dev:api    # Terminal 2 → http://localhost:8787
```

**Need help?** See the [detailed setup guide](#development-setup) below.

---

## Tech Stack

<details>
<summary>Click to expand</summary>

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

</details>

---

## Development Setup

### Prerequisites

- **Node.js 20+** and **pnpm 8+**
- **Docker + Docker Compose** (for local Postgres)
- **Cloudflare account** (Workers + R2)
- **OAuth apps** from Google and GitHub
- *(Optional)* LinkedIn Partner API, Indeed Publisher account

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

ApplyMe has two parts that deploy separately:

### 1. API → Cloudflare Workers

The API must run on Cloudflare Workers (it uses Workers-specific features).

```bash
cd apps/api
pnpm wrangler login
pnpm wrangler deploy
```

This gives you a URL like `https://applyme-api.your-account.workers.dev`

### 2. Web → Netlify or Vercel

The Next.js app can deploy to either platform.

#### Option A: Netlify

1. Push your code to GitHub
2. Connect repo to Netlify
3. Set build settings:
   - **Base directory**: `apps/web`
   - **Build command**: `cd ../.. && pnpm install && pnpm --filter @applyme/web build`
   - **Publish directory**: `apps/web/.next`
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Cloudflare Workers URL

The included `netlify.toml` handles the rest.

#### Option B: Vercel

```bash
cd apps/web
vercel login
vercel --prod
```

Set `NEXT_PUBLIC_API_URL` in Vercel dashboard.

### 3. Database → Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy connection string to `DATABASE_URL` in Cloudflare Workers env
3. Run migrations:
   ```bash
   pnpm db:migrate
   ```

### Deploy Helper Scripts

For convenience, use the included deploy scripts:

```bash
./scripts/deploy.sh api:prod      # Deploy API to Cloudflare
./scripts/deploy.sh web:prod      # Deploy web to Vercel
./scripts/deploy.sh all:prod      # Deploy both
```

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
**Code Style:**
- TypeScript strict mode
- Prettier for formatting (run `pnpm format`)
- ESLint rules enforced

---

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) — React framework
- [Cloudflare Workers](https://workers.cloudflare.com/) — Serverless API
- [Drizzle ORM](https://orm.drizzle.team/) — Type-safe database toolkit
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful UI components
- [Hono](https://hono.dev/) — Lightweight web framework

Special thanks to the open-source community for making this possible.

---

## Support

- 📧 **Email**: support@applyme.dev
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/applyme/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/applyme/discussions)

---

Made with ❤️ for Canadian job seekers
