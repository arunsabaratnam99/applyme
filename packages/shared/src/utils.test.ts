import { describe, it, expect } from 'vitest';
import type { NotificationPrefs } from './types/index.js';
import {
  isCanadianLocation,
  normalizeLocation,
  sanitizeForLog,
  relativeTime,
  isInQuietHours,
  draftExpiresAt,
  queueExpiresAt,
} from './utils.js';

describe('isCanadianLocation', () => {
  it('recognises Canadian cities', () => {
    expect(isCanadianLocation('Toronto, ON')).toBe(true);
    expect(isCanadianLocation('Vancouver, BC')).toBe(true);
  });

  it('recognises province names', () => {
    expect(isCanadianLocation('Ontario')).toBe(true);
    expect(isCanadianLocation('British Columbia')).toBe(true);
  });

  it('recognises remote Canada strings', () => {
    expect(isCanadianLocation('Remote Canada')).toBe(true);
    expect(isCanadianLocation('Anywhere in Canada')).toBe(true);
  });

  it('returns false for non-Canadian locations', () => {
    expect(isCanadianLocation('San Francisco, CA')).toBe(false);
    expect(isCanadianLocation('London, UK')).toBe(false);
  });
});

describe('normalizeLocation', () => {
  it('normalises empty string to CA-remote', () => {
    expect(normalizeLocation('')).toBe('CA-remote');
  });

  it('normalises "remote" to CA-remote', () => {
    expect(normalizeLocation('remote')).toBe('CA-remote');
    expect(normalizeLocation('Remote')).toBe('CA-remote');
  });

  it('preserves city strings', () => {
    expect(normalizeLocation('Toronto, ON')).toBe('Toronto, ON');
  });
});

describe('sanitizeForLog', () => {
  it('redacts PII fields', () => {
    const result = sanitizeForLog({ email: 'user@example.com', name: 'Alice' });
    expect(result['email']).toBe('[REDACTED]');
    expect(result['name']).toBe('Alice');
  });

  it('redacts nested PII', () => {
    const result = sanitizeForLog({ profile: { email: 'user@example.com', location: 'Toronto' } });
    const profile = result['profile'] as Record<string, unknown>;
    expect(profile['email']).toBe('[REDACTED]');
    expect(profile['location']).toBe('Toronto');
  });
});

describe('relativeTime', () => {
  it('returns "just now" for very recent dates', () => {
    expect(relativeTime(new Date())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(relativeTime(d)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const d = new Date(Date.now() - 3 * 3_600_000);
    expect(relativeTime(d)).toBe('3h ago');
  });
});

describe('isInQuietHours', () => {
  it('returns false when no quiet hours set', () => {
    expect(isInQuietHours({ quietStart: null, quietEnd: null } as unknown as NotificationPrefs, 23, 0)).toBe(false);
  });

  it('returns true within a same-day range', () => {
    expect(isInQuietHours({ quietStart: '22:00', quietEnd: '23:59' } as unknown as NotificationPrefs, 23, 0)).toBe(true);
  });

  it('returns true within an overnight range', () => {
    expect(isInQuietHours({ quietStart: '22:00', quietEnd: '08:00' } as unknown as NotificationPrefs, 0, 30)).toBe(true);
  });

  it('returns false outside quiet hours', () => {
    expect(isInQuietHours({ quietStart: '22:00', quietEnd: '08:00' } as unknown as NotificationPrefs, 12, 0)).toBe(false);
  });
});

describe('draftExpiresAt / queueExpiresAt', () => {
  it('draftExpiresAt is roughly 30 days from now', () => {
    const exp = draftExpiresAt();
    const diff = exp.getTime() - Date.now();
    expect(diff).toBeGreaterThan(29 * 86_400_000);
    expect(diff).toBeLessThan(31 * 86_400_000);
  });

  it('queueExpiresAt is roughly 72 hours from now', () => {
    const exp = queueExpiresAt();
    const diff = exp.getTime() - Date.now();
    expect(diff).toBeGreaterThan(71 * 3_600_000);
    expect(diff).toBeLessThan(73 * 3_600_000);
  });
});
