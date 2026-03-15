import type { Database } from '@applyme/db';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  APP_BASE_URL: string;

  // OAuth
  OAUTH_GOOGLE_CLIENT_ID: string;
  OAUTH_GOOGLE_CLIENT_SECRET: string;
  OAUTH_GITHUB_CLIENT_ID: string;
  OAUTH_GITHUB_CLIENT_SECRET: string;

  // R2
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_ENDPOINT: string;
  R2_PUBLIC_URL: string;

  // VAPID
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;

  // Email
  EMAIL_ENABLED: string;
  RESEND_API_KEY?: string;

  // LinkedIn scraper (public job feed, no API approval needed)
  LINKEDIN_SCRAPER_ENABLED: string;

  // Indeed scraper — uses JSearch API via RapidAPI (free tier)
  INDEED_SCRAPER_ENABLED: string;
  RAPIDAPI_KEY?: string;

  // Sentry
  SENTRY_DSN?: string;

  // Workers AI
  AI: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
  AI_ENABLED: string;

  // Browser Rendering (Cloudflare)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BROWSER: any;
  BROWSER_ENABLED: string;

  // Admin
  CRON_SECRET?: string;
}

export interface Variables {
  db: Database;
  userId: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
}
