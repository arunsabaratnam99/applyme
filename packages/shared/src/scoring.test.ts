import { describe, it, expect } from 'vitest';
import { scoreJob } from './scoring.js';
import type { Job, UserProfile } from './types/index.js';

const baseProfile: UserProfile = {
  userId: 'user-1',
  displayName: null,
  country: 'CA',
  locations: ['Toronto'],
  roles: ['Software Engineer'],
  keywords: ['TypeScript', 'React'],
  excludeKeywords: [],
  preferredRemote: false,
  visaAuth: 'citizen',
  jobCategories: ['software'],
  employmentTypes: ['full_time'],
  salaryMin: null,
  salaryMax: null,
} as unknown as UserProfile;

const baseJob: Job = {
  id: 'job-1',
  title: 'Software Engineer',
  company: 'Shopify',
  location: 'Toronto, ON',
  descriptionPlain: 'Work with TypeScript and React to build great products.',
  workplaceType: 'onsite',
  employmentType: 'full_time',
  jobCategory: 'software',
  sourceType: 'ashby',
  applyUrl: 'https://jobs.ashbyhq.com/shopify/123',
  jobUrl: 'https://jobs.ashbyhq.com/shopify/123',
  externalId: 'shopify-123',
  postedAt: null,
  expiresAt: null,
  rawJson: {},
} as unknown as Job;

function score(jobOverrides: Partial<Job> = {}, profileOverrides: Partial<UserProfile> = {}) {
  const job = { ...baseJob, ...jobOverrides } as unknown as Job;
  const profile = { ...baseProfile, ...profileOverrides } as unknown as UserProfile;
  return scoreJob({ job, profile, watchlistItems: [] });
}

describe('scoreJob', () => {
  it('returns a positive score for a matching job', () => {
    expect(score().score).toBeGreaterThan(0);
  });

  it('scores remote higher when preferredRemote is true', () => {
    const remoteScore = score({ workplaceType: 'remote' }, { preferredRemote: true }).score;
    const onsiteScore = score({ workplaceType: 'onsite' }, { preferredRemote: true }).score;
    expect(remoteScore).toBeGreaterThan(onsiteScore);
  });

  it('penalises excluded keywords', () => {
    const withPenalty = score({ descriptionPlain: 'Experience with C++ required.' }, { excludeKeywords: ['C++'] }).score;
    const without = score({ descriptionPlain: 'TypeScript and React codebase.' }, { excludeKeywords: ['C++'] }).score;
    expect(without).toBeGreaterThan(withPenalty);
  });

  it('includes keyword match reasons', () => {
    expect(score().reasons.length).toBeGreaterThan(0);
  });

  it('gives zero score for excluded employment type', () => {
    expect(score({ employmentType: 'internship' }).score).toBe(0);
  });

  it('gives zero score for excluded job category', () => {
    expect(score({ jobCategory: 'business' }).score).toBe(0);
  });
});
