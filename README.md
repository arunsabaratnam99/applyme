# ApplyMe

Job search and application tracking for Canadian tech roles.

ApplyMe aggregates openings from multiple sources, helps you submit applications with your saved profile, and keeps a record of what you sent and when.

**Use the app:** [aapplyme.netlify.app](https://aapplyme.netlify.app)

## What it does

**Job discovery**
- Aggregates listings from Ashby, Lever, Greenhouse, Job Bank Canada, LinkedIn, Indeed, and curated GitHub repos
- Filters by location, job type (full-time, internship), and category (software, business)
- Suggests similar companies when you watch a target employer

**Applications**
- Instant apply for email- and API-based postings (with your approval)
- One-click autofill for form-based jobs via the browser extension
- Draft review for selected employers before submission

**Tracking**
- Timeline of every application
- Submitted answers, resume version, and cover letter on file
- Expiry reminders for time-sensitive postings

**Interface**
- Light and dark mode
- Installable as a PWA
- Web push notifications for new matches

## Architecture

| Layer | Tech |
|---|---|
| Web | Next.js 14, TypeScript, TailwindCSS, shadcn/ui |
| API | Cloudflare Workers, Hono |
| Database | Postgres (Neon), Drizzle ORM |
| Storage | Cloudflare R2 |
| Auth | OAuth 2.0 PKCE (Google, GitHub) |
| Extension | Chrome/Firefox Manifest V3 |

## Repository

This repository is source reference only. It is not set up for cloning or self-hosting. Use the hosted application linked above.

All rights reserved. Unauthorized copying, distribution, or use of this code is prohibited.
