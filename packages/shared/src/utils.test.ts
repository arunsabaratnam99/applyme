import { describe, it, expect } from 'vitest';
import {
  isCanadianLocation,
  normalizeLocation,
  sanitizeForLog,
  relativeTime,
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
