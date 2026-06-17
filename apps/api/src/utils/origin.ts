import type { Env } from '../types.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Netlify deploy previews for the same site, e.g. deploy-preview-42--aapplyme.netlify.app */
function netlifySiteOriginPattern(appBaseUrl: string): RegExp | null {
  try {
    const hostname = new URL(appBaseUrl).hostname;
    if (!hostname.endsWith('.netlify.app')) return null;
    const siteName = hostname.includes('--')
      ? hostname.split('--').pop()!.replace('.netlify.app', '')
      : hostname.replace('.netlify.app', '');
    return new RegExp(`^https://([a-z0-9-]+--)?${escapeRegex(siteName)}\\.netlify\\.app$`);
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string, env: Pick<Env, 'APP_BASE_URL' | 'ALLOWED_ORIGINS'>): boolean {
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) return false;

  if (origin === env.APP_BASE_URL) return true;

  const extras = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (extras.includes(origin)) return true;

  const netlifyPattern = netlifySiteOriginPattern(env.APP_BASE_URL);
  if (netlifyPattern?.test(origin)) return true;

  const appBase = env.APP_BASE_URL;
  const isDev =
    appBase.startsWith('http://localhost') || appBase.startsWith('http://127.0.0.1');
  if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return true;
  }

  return false;
}

export function resolveOrigin(
  requested: string | undefined,
  env: Pick<Env, 'APP_BASE_URL' | 'ALLOWED_ORIGINS'>,
): string {
  if (requested && isAllowedOrigin(requested, env)) return requested;
  return env.APP_BASE_URL;
}

export function corsOrigin(origin: string | undefined, env: Pick<Env, 'APP_BASE_URL' | 'ALLOWED_ORIGINS'>): string | null {
  const fallback = env.APP_BASE_URL;
  if (!origin) return fallback;
  return isAllowedOrigin(origin, env) ? origin : null;
}
