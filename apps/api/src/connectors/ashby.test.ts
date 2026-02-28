import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAshbyJobs } from './ashby.js';
import fixture from './__fixtures__/ashby.json';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => fixture,
  }));
});

describe('fetchAshbyJobs', () => {
  it('returns normalized jobs from fixture', async () => {
    const jobs = await fetchAshbyJobs('testco');
    expect(jobs).toHaveLength(2);
  });

  it('correctly maps title and company', async () => {
    const jobs = await fetchAshbyJobs('testco');
    const first = jobs[0];
    expect(first).toBeDefined();
    expect(first!.title).toBe('Software Engineer, Backend');
    expect(first!.company).toBe('testco');
  });

  it('extracts applyUrl', async () => {
    const jobs = await fetchAshbyJobs('testco');
    expect(jobs[0]!.applyUrl).toContain('ashbyhq.com');
  });

  it('classifies employment type as internship for intern title', async () => {
    const jobs = await fetchAshbyJobs('testco');
    const intern = jobs.find((j) => j.title.toLowerCase().includes('intern'));
    expect(intern).toBeDefined();
    expect(intern!.employmentType).toBe('internship');
  });

  it('returns empty array if fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const jobs = await fetchAshbyJobs('testco');
    expect(jobs).toEqual([]);
  });
});
