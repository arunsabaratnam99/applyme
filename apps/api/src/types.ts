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

  // VAPID
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;

  // Email
  EMAIL_ENABLED: string;
  RESEND_API_KEY?: string;

  // LinkedIn
  LINKEDIN_ENABLED: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;

  // Indeed
  INDEED_ENABLED: string;
  INDEED_PUBLISHER_ID?: string;

  // Sentry
  SENTRY_DSN?: string;
}

export interface Variables {
  db: Database;
  userId: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
}
