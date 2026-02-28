import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLeverJobs } from './lever.js';
import fixture from './__fixtures__/lever.json';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => fixture,
  }));
});

describe('fetchLeverJobs', () => {
  it('returns normalized jobs from fixture', async () => {
    const jobs = await fetchLeverJobs('testco');
    expect(jobs).toHaveLength(2);
  });

  it('maps title correctly', async () => {
    const jobs = await fetchLeverJobs('testco');
    expect(jobs[0]!.title).toBe('Senior Frontend Engineer');
  });

  it('maps applyUrl correctly', async () => {
    const jobs = await fetchLeverJobs('testco');
    expect(jobs[0]!.applyUrl).toContain('lever.co');
  });

  it('classifies co-op employment type', async () => {
    const jobs = await fetchLeverJobs('testco');
    const coop = jobs.find((j) => j.title.toLowerCase().includes('co-op'));
    expect(coop).toBeDefined();
    expect(coop!.employmentType).toBe('co_op');
  });

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const jobs = await fetchLeverJobs('testco');
    expect(jobs).toEqual([]);
  });
});
