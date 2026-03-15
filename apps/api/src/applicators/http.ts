import type { Env } from '../types.js';

export interface FieldMap {
  fields: Array<{
    fieldKey: string;
    selector: string | null;
    label: string;
    profileValue: string;
    inputType: string;
  }>;
  atsType: string;
  domain: string;
  learnedAt: string | null;
}

export interface ApplyPayload {
  queueItemId: string;
  applyUrl: string;
  atsType: string;
  fieldMap: FieldMap;
  resumePdfUrl: string | null;
  coverLetter: string;
}

export interface ApplyResult {
  success: boolean;
  response?: Record<string, unknown>;
  error?: string;
}

function fieldValue(fieldMap: FieldMap, key: string): string {
  return fieldMap.fields.find((f) => f.fieldKey === key)?.profileValue ?? '';
}

// ─── Ashby ────────────────────────────────────────────────────────────────────

export async function applyViaAshby(payload: ApplyPayload): Promise<ApplyResult> {
  // Ashby apply URL format: https://jobs.ashbyhq.com/:company/:jobId
  // Submission: POST https://api.ashbyhq.com/posting-public/apiKey/:company/applications/:jobId
  const match = payload.applyUrl.match(/jobs\.ashbyhq\.com\/([^/]+)\/([^/?]+)/i);
  if (!match) return { success: false, error: 'Could not parse Ashby job URL' };
  const [, boardSlug, jobId] = match;

  const form = new FormData();
  form.append('name', fieldValue(payload.fieldMap, 'first_name') + ' ' + fieldValue(payload.fieldMap, 'last_name'));
  form.append('email', fieldValue(payload.fieldMap, 'email'));
  form.append('phone', fieldValue(payload.fieldMap, 'phone'));
  form.append('coverLetter', payload.coverLetter);

  const linkedinUrl = fieldValue(payload.fieldMap, 'linkedin_url');
  if (linkedinUrl) form.append('linkedIn', linkedinUrl);

  const websiteUrl = fieldValue(payload.fieldMap, 'website_url');
  if (websiteUrl) form.append('website', websiteUrl);

  if (payload.resumePdfUrl) {
    try {
      const resumeRes = await fetch(payload.resumePdfUrl, { signal: AbortSignal.timeout(15000) });
      if (resumeRes.ok) {
        const blob = await resumeRes.blob();
        form.append('resume', blob, 'resume.pdf');
      }
    } catch {
      // Continue without resume
    }
  }

  try {
    const res = await fetch(
      `https://api.ashbyhq.com/posting-public/apiKey/${boardSlug}/applications/${jobId}`,
      { method: 'POST', body: form, signal: AbortSignal.timeout(20000) },
    );
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok) return { success: true, response: data };
    return { success: false, error: `Ashby returned ${res.status}: ${JSON.stringify(data)}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Lever ────────────────────────────────────────────────────────────────────

export async function applyViaLever(payload: ApplyPayload): Promise<ApplyResult> {
  // Lever apply URL: https://jobs.lever.co/:company/:jobId/apply
  // or https://jobs.lever.co/:company/:jobId
  const match = payload.applyUrl.match(/jobs\.lever\.co\/([^/]+)\/([^/?]+)/i);
  if (!match) return { success: false, error: 'Could not parse Lever job URL' };
  const [, company, jobId] = match;

  const form = new FormData();
  form.append('name', fieldValue(payload.fieldMap, 'first_name') + ' ' + fieldValue(payload.fieldMap, 'last_name'));
  form.append('email', fieldValue(payload.fieldMap, 'email'));
  form.append('phone', fieldValue(payload.fieldMap, 'phone'));
  form.append('comments', payload.coverLetter);

  const linkedinUrl = fieldValue(payload.fieldMap, 'linkedin_url');
  if (linkedinUrl) form.append('urls[LinkedIn]', linkedinUrl);

  const githubUrl = fieldValue(payload.fieldMap, 'github_url');
  if (githubUrl) form.append('urls[GitHub]', githubUrl);

  const websiteUrl = fieldValue(payload.fieldMap, 'website_url');
  if (websiteUrl) form.append('urls[Portfolio]', websiteUrl);

  if (payload.resumePdfUrl) {
    try {
      const resumeRes = await fetch(payload.resumePdfUrl, { signal: AbortSignal.timeout(15000) });
      if (resumeRes.ok) {
        const blob = await resumeRes.blob();
        form.append('resume', blob, 'resume.pdf');
      }
    } catch {
      // Continue without resume
    }
  }

  try {
    const res = await fetch(
      `https://jobs.lever.co/${company}/${jobId}/apply`,
      {
        method: 'POST',
        body: form,
        headers: { 'Origin': 'https://jobs.lever.co', 'Referer': payload.applyUrl },
        signal: AbortSignal.timeout(20000),
      },
    );
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok) return { success: true, response: data };
    return { success: false, error: `Lever returned ${res.status}: ${JSON.stringify(data)}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
