const ALLOWED_JOB_HOSTS = [
  'linkedin.com',
  'www.linkedin.com',
  'boards.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
  'apply.workable.com',
  'jobs.smartrecruiters.com',
  'myworkdayjobs.com',
  'wd1.myworkdayjobs.com',
  'wd3.myworkdayjobs.com',
  'wd5.myworkdayjobs.com',
];

function hostMatches(hostname: string, allowed: string): boolean {
  return hostname === allowed || hostname.endsWith(`.${allowed}`);
}

export function isAllowedJobUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === '169.254.169.254' ||
    hostname.endsWith('.internal')
  ) {
    return false;
  }

  return ALLOWED_JOB_HOSTS.some((allowed) => hostMatches(hostname, allowed));
}
