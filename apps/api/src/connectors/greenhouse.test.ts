import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGreenhouseJobs } from './greenhouse.js';
import fixture from './__fixtures__/greenhouse.json';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => fixture,
  }));
});

describe('fetchGreenhouseJobs', () => {
  it('returns normalized jobs from fixture', async () => {
    const jobs = await fetchGreenhouseJobs('testco');
    expect(jobs).toHaveLength(2);
  });

  it('maps title correctly', async () => {
    const jobs = await fetchGreenhouseJobs('testco');
    expect(jobs[0]!.title).toBe('Backend Engineer (Go)');
  });

  it('maps applyUrl to absolute_url', async () => {
    const jobs = await fetchGreenhouseJobs('testco');
    expect(jobs[0]!.applyUrl).toContain('greenhouse.io');
  });

  it('classifies a business role correctly', async () => {
    const jobs = await fetchGreenhouseJobs('testco');
    const marketing = jobs.find((j) => j.title.toLowerCase().includes('marketing'));
    expect(marketing).toBeDefined();
    expect(marketing!.jobCategory).toBe('business');
  });

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const jobs = await fetchGreenhouseJobs('testco');
    expect(jobs).toEqual([]);
  });
});
