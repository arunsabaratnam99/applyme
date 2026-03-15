import { applyViaAshby, applyViaLever } from './http.js';
import { applyViaBrowser } from './browser.js';
import type { ApplyPayload, ApplyResult } from './http.js';
import type { Env } from '../types.js';

export type { ApplyPayload, ApplyResult };

// Tier 1: direct HTTP API — fast, reliable, no browser needed
const TIER1_ATS = new Set(['ashby', 'lever']);

// Tier 2: browser-based submission
// Greenhouse uses embed form which requires a browser session cookie — cannot be submitted via plain HTTP
const TIER2_ATS = new Set(['greenhouse', 'workday', 'linkedin', 'indeed', 'taleo', 'icims', 'unknown']);

/** Detect ATS from the apply URL hostname only — ignores path/query to avoid false matches
 *  when ATS domains appear as redirect params in Simplify/LinkedIn/Indeed URLs. */
function detectAtsFromUrl(url: string): string | null {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch { return null; }
  if (/myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/.test(hostname)) return 'workday';
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(hostname)) return 'greenhouse';
  if (/jobs\.lever\.co/.test(hostname)) return 'lever';
  if (/jobs\.ashbyhq\.com|boards\.ashbyhq\.com/.test(hostname)) return 'ashby';
  if (/\.taleo\.net/.test(hostname)) return 'taleo';
  if (/\.icims\.com/.test(hostname)) return 'icims';
  if (/\.linkedin\.com/.test(hostname)) return 'linkedin';
  if (/\.indeed\.com/.test(hostname)) return 'indeed';
  return null;
}

export async function attemptApply(payload: ApplyPayload, env: Env): Promise<ApplyResult> {
  let { atsType } = payload;

  // If the stored applyUrl already points to a known ATS (e.g. LinkedIn job that
  // stores a direct Greenhouse/Lever/Workday URL), override the atsType.
  const urlDetected = detectAtsFromUrl(payload.applyUrl);
  if (urlDetected && urlDetected !== 'linkedin') {
    atsType = urlDetected;
  }

  // Tier 1: direct HTTP API
  if (TIER1_ATS.has(atsType)) {
    switch (atsType) {
      case 'ashby':      return applyViaAshby(payload);
      case 'lever':      return applyViaLever(payload);
    }
  }

  // Tier 2: browser
  if (TIER2_ATS.has(atsType)) {
    return applyViaBrowser({ ...payload, atsType }, env);
  }

  return { success: false, error: `Unsupported ATS type: ${atsType}` };
}
