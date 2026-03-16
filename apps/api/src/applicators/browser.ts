import puppeteer from '@cloudflare/puppeteer';
import type { Browser, Page } from '@cloudflare/puppeteer';
import type { Env } from '../types.js';
import type { ApplyPayload, ApplyResult } from './http.js';

// Cloudflare Browser Rendering — @cloudflare/puppeteer
// The `BROWSER` binding must be set in wrangler.toml as [browser]
// This module is only loaded when BROWSER_ENABLED=true

// ─── Pre-fetch: resolve LinkedIn external URL before launching browser ─────────

export async function resolveLinkedInApplyUrl(jobUrl: string): Promise<string | null> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Extract numeric job ID from any LinkedIn job URL format
  const jobIdMatch = jobUrl.match(/(?:jobs\/view\/|jobPosting\/)(\d+)/i);
  const jobId = jobIdMatch?.[1];

  // Helper: extract the first non-LinkedIn URL matching our known patterns from HTML
  function extractApplyUrl(html: string, source: string): string | null {
    // PRIMARY: LinkedIn jobPosting API embeds the apply URL inside an HTML comment in
    // <code id="applyUrl" style="display: none"><!--"https://...externalApply/...?url=ENCODED_ATS_URL"--></code>
    // The real ATS URL is the url= query param of the LinkedIn externalApply redirect.
    const codeTagMatch = html.match(/<code[^>]*id="applyUrl"[^>]*><!--"([^"]+)"--><\/code>/i);
    if (codeTagMatch?.[1]) {
      const rawHref = codeTagMatch[1].replace(/&amp;/g, '&');
      // Extract the url= param from the externalApply redirect
      const urlParam = new URL(rawHref).searchParams.get('url');
      if (urlParam) {
        const atsUrl = decodeURIComponent(urlParam);
        if (!atsUrl.includes('linkedin.com') && atsUrl.startsWith('http')) {
          return atsUrl;
        }
      }
      // If no url= param, the href itself might be the direct ATS URL
      if (!rawHref.includes('linkedin.com') && rawHref.startsWith('http')) {
        return rawHref;
      }
    }

    // FALLBACK patterns for other LinkedIn page formats
    const patterns = [
      // Embedded JSON blob
      /"applyUrl"\s*:\s*"(https?:\/\/[^"]+)"/,
      /"apply_url"\s*:\s*"(https?:\/\/[^"]+)"/,
      // JSON-LD structured data
      /"url"\s*:\s*"(https?:\/\/(?!(?:www\.)?linkedin\.com)[^"]+)"/,
      // HTML attribute offsite link
      /data-tracking-control-name="public_jobs_apply-link-offsite"[^>]*href="([^"]+)"/i,
      /href="([^"]+)"[^>]*data-tracking-control-name="public_jobs_apply-link-offsite"/i,
      // Generic apply button href
      /class="apply-button[^"]*"[^>]*href="([^"]+)"/i,
      // Any href that looks like an ATS URL
      /href="(https?:\/\/(?:[^"]*\.(?:greenhouse|lever|workday|ashbyhq|taleo|icims|jobvite|smartrecruiters|bamboohr|recruitee|dover|rippling)[^"]*))"/i,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m?.[1]) {
        const url = decodeURIComponent(m[1].replace(/&amp;/g, '&').replace(/\\/g, ''));
        if (!url.includes('linkedin.com') && url.startsWith('http')) {
          return url;
        }
      }
    }
    // If the page is a valid LinkedIn job (has decoratedJobPostingId) but no external
    // applyUrl was found, it's an Easy Apply job — signal the caller to use jobUrl directly.
    if (html.includes('id="decoratedJobPostingId"')) {
      return 'EASY_APPLY';
    }
    return null;
  }

  try {
    // Primary: use the jobs-guest jobPosting API endpoint — returns static HTML
    // with embedded JSON that reliably contains applyUrl for offsite applications
    if (jobId) {
      const postingUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
      const postingRes = await fetch(postingUrl, { headers, signal: AbortSignal.timeout(8000) });
      if (postingRes.ok) {
        const html = await postingRes.text();
        const found = extractApplyUrl(html, 'jobPosting API');
        if (found === 'EASY_APPLY') {
          // Easy Apply job — no external ATS URL. Return the clean job view URL so
          // the Apply button opens the LinkedIn job page where the user can Easy Apply.
          return `https://www.linkedin.com/jobs/view/${jobId}/`;
        }
        if (found) return found;
      } else {
        console.warn(`[resolveLinkedIn] jobPosting API returned ${postingRes.status} for job ${jobId}`);
      }
    }

    // Fallback: try the original job view URL
    const res = await fetch(jobUrl, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = await res.text();
    return extractApplyUrl(html, 'jobUrl fallback');
  } catch (err) {
    console.error(`[resolveLinkedIn] exception for ${jobUrl}: ${err}`);
    return null;
  }
}

// ─── Pre-fetch resume bytes before launching browser ──────────────────────────

async function fetchResumeBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
  } catch {
    return null;
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function applyViaBrowser(payload: ApplyPayload, env: Env): Promise<ApplyResult> {
  if (!env.BROWSER || env.BROWSER_ENABLED !== 'true') {
    return { success: false, error: 'Browser Rendering not enabled (set BROWSER_ENABLED=true and add [browser] binding)' };
  }

  // ── Pre-work outside browser session ──────────────────────────────────────
  let effectiveUrl = payload.applyUrl;
  let effectiveAts = payload.atsType;

  // For Greenhouse canonical path URLs (boards.greenhouse.io/company/jobs/id),
  // convert to embed URL so the browser lands on the application form directly
  if (payload.atsType === 'greenhouse') {
    const pathM = effectiveUrl.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i);
    if (pathM && pathM[1] !== 'embed') {
      effectiveUrl = `https://boards.greenhouse.io/embed/job_app?token=${pathM[2]}`;
    }
  }

  // For LinkedIn: try to resolve the external apply URL before opening browser
  if (payload.atsType === 'linkedin' && payload.applyUrl.includes('linkedin.com')) {
    const resolved = await resolveLinkedInApplyUrl(payload.applyUrl);
    if (resolved) {
      effectiveUrl = resolved;
      effectiveAts = detectAtsFromUrl(resolved);
    }
  }

  // Pre-fetch resume bytes so the browser session doesn't spend time on it
  let resumeBase64: string | null = null;
  if (payload.resumePdfUrl) {
    resumeBase64 = await fetchResumeBase64(payload.resumePdfUrl);
  }

  const effectivePayload: ApplyPayload = { ...payload, applyUrl: effectiveUrl, atsType: effectiveAts };

  // ── Browser session ────────────────────────────────────────────────────────
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1280, height: 900 });

    // domcontentloaded is enough — we don't need ads/fonts/analytics to load
    await page.goto(effectiveUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    if (effectiveAts === 'greenhouse') {
      await fillGreenhouse(page, effectivePayload, resumeBase64);
    } else if (effectiveAts === 'workday') {
      await fillWorkday(page, effectivePayload, resumeBase64);
    } else if (effectiveAts === 'linkedin') {
      // Still on LinkedIn (pre-resolve failed) — extract link from live DOM
      await fillLinkedIn(page, effectivePayload, resumeBase64);
    } else if (effectiveAts === 'indeed') {
      await fillIndeed(page, effectivePayload, resumeBase64);
    } else if (effectiveAts === 'icims') {
      await fillIcims(page, effectivePayload, resumeBase64);
    } else if (effectiveAts === 'taleo') {
      await fillTaleo(page, effectivePayload, resumeBase64);
    } else {
      await fillGenericForm(page, effectivePayload, resumeBase64);
    }

    await browser.close();
    return { success: true, response: { atsType: effectiveAts, url: effectiveUrl } };
  } catch (err) {
    try { await browser?.close(); } catch { /* ignore */ }
    return { success: false, error: String(err) };
  }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function fv(payload: ApplyPayload, key: string): string {
  return payload.fieldMap.fields.find((f) => f.fieldKey === key)?.profileValue ?? '';
}

/** Set a field value instantly via JS — no character-by-character typing delay */
async function setFieldValue(page: Page, selector: string, value: string): Promise<boolean> {
  try {
    const found = await page.evaluate(
      (sel, val) => {
        const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!el) return false;
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
        return true;
      },
      selector,
      value,
    );
    return found as boolean;
  } catch {
    return false;
  }
}

async function trySelectors(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const sel of selectors) {
    const ok = await setFieldValue(page, sel, value);
    if (ok) return true;
  }
  return false;
}

async function fillByLabel(page: Page, labelText: string, value: string): Promise<boolean> {
  try {
    const result = await page.evaluate(
      (text, val) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const label = labels.find((l) => l.textContent?.toLowerCase().includes((text as string).toLowerCase()));
        if (!label) return false;
        const id = label.getAttribute('for');
        const input = id
          ? document.getElementById(id)
          : label.querySelector('input, textarea, select');
        if (!input) return false;
        (input as HTMLInputElement).value = val as string;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      },
      labelText,
      value,
    );
    return result as boolean;
  } catch {
    return false;
  }
}

async function injectResumeFile(page: Page, base64: string): Promise<boolean> {
  const fileInputSelectors = [
    'input[type="file"]',
    'input[accept*="pdf"]',
    'input[name*="resume"]',
    'input[id*="resume"]',
  ];
  for (const sel of fileInputSelectors) {
    try {
      const fileInput = await page.$(sel);
      if (!fileInput) continue;
      await page.evaluate(
        (selector, b64) => {
          const input = document.querySelector(selector as string) as HTMLInputElement;
          if (!input) return;
          const byteCharacters = atob(b64 as string);
          const byteArray = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
          const file = new File([byteArray], 'resume.pdf', { type: 'application/pdf' });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        },
        sel,
        base64,
      );
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function uploadResume(page: Page, payload: ApplyPayload, preloadedBase64: string | null): Promise<boolean> {
  const base64 = preloadedBase64 ?? (payload.resumePdfUrl ? await fetchResumeBase64(payload.resumePdfUrl) : null);
  if (!base64) return false;
  return injectResumeFile(page, base64);
}

async function clickSubmit(page: Page): Promise<boolean> {
  const submitSelectors = [
    // Greenhouse embed-specific
    '#submit_app',
    'input[type="submit"][value*="Submit"]',
    'input[type="submit"][value*="Apply"]',
    'button#submit_app',
    // Generic
    'button[type="submit"]',
    'input[type="submit"]',
    'button[data-automation-id="bottom-navigation-next-button"]',
    'button[aria-label*="submit" i]',
    '.apply-button',
    '#submit-app',
  ];
  for (const sel of submitSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForNavigation({ timeout: 8000, waitUntil: 'load' }).catch(() => {});
        return true;
      }
    } catch {
      continue;
    }
  }

  // Last resort: find any visible button/input whose text includes "Submit" or "Apply"
  const found = await page.evaluate(() => {
    const candidates = [
      ...Array.from(document.querySelectorAll('button, input[type="submit"]')),
    ] as HTMLElement[];
    const btn = candidates.find((el) => {
      const text = (el.textContent ?? (el as HTMLInputElement).value ?? '').trim().toLowerCase();
      return text.includes('submit') || text === 'apply';
    });
    if (btn) { (btn as HTMLElement).click(); return true; }
    return false;
  }).catch(() => false);

  if (found) {
    await page.waitForNavigation({ timeout: 8000, waitUntil: 'load' }).catch(() => {});
    return true;
  }

  return false;
}

// ─── ATS detection from URL ──────────────────────────────────────────────────

function detectAtsFromUrl(url: string): string {
  if (/boards\.greenhouse\.io|greenhouse\.io\/jobs/.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co|lever\.co/.test(url)) return 'lever';
  if (/jobs\.ashby\.com|ashbyhq\.com/.test(url)) return 'ashby';
  if (/myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/.test(url)) return 'workday';
  if (/\.icims\.com/.test(url)) return 'icims';
  if (/taleo\.net/.test(url)) return 'taleo';
  return 'unknown';
}

// ─── ATS-specific fill strategies ─────────────────────────────────────────────

async function fillGreenhouse(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  // Greenhouse embed form — wait for the form to render
  await page.waitForSelector('#application_form, form#application, form[action*="greenhouse"]', { timeout: 10000 }).catch(() => {});

  // Core fields
  await trySelectors(page, ['#first_name', 'input[name="job_application[first_name]"]'], fv(payload, 'first_name'));
  await trySelectors(page, ['#last_name',  'input[name="job_application[last_name]"]'],  fv(payload, 'last_name'));
  await trySelectors(page, ['#email',  'input[name="job_application[email]"]', 'input[type="email"]'], fv(payload, 'email'));
  await trySelectors(page, ['#phone',  'input[name="job_application[phone]"]', 'input[type="tel"]'],   fv(payload, 'phone'));

  if (payload.coverLetter) {
    await trySelectors(page, ['#cover_letter_text', 'textarea[name="job_application[cover_letter_text]"]'], payload.coverLetter);
  }

  // Fill all custom question fields from the fieldMap
  for (const field of payload.fieldMap.fields) {
    if (!field.profileValue) continue;
    const fk = field.fieldKey;
    // Skip standard fields already handled above
    if (['first_name', 'last_name', 'email', 'phone', 'cover_letter', 'resume'].includes(fk)) continue;

    const val = field.profileValue;

    // Try by question_id in name attribute (Greenhouse custom questions)
    // Greenhouse uses: job_application[answers_attributes][N][text_value]
    //                  job_application[answers_attributes][N][boolean_value]
    //                  job_application[answers_attributes][N][answer_selected_options][]
    if (field.inputType === 'select') {
      // Single-select dropdown
      await page.evaluate((label: string, value: string) => {
        const labels = Array.from(document.querySelectorAll('label, .field label'));
        const lbl = labels.find((l) => l.textContent?.toLowerCase().includes(label.toLowerCase()));
        if (!lbl) return false;
        const sel = lbl.closest('.field')?.querySelector('select') as HTMLSelectElement | null;
        if (!sel) return false;
        const opt = Array.from(sel.options).find((o) => o.text.toLowerCase().includes(value.toLowerCase()));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, field.label, val).catch(() => {});
    } else if (field.inputType === 'checkbox') {
      // Multi-select checkboxes — value may be comma-separated
      const selectedValues = val.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
      await page.evaluate((label: string, values: string[]) => {
        const labels = Array.from(document.querySelectorAll('label, .field label, .multi-checkboxes label'));
        const container = labels.find((l) => l.textContent?.toLowerCase().includes(label.toLowerCase()))
          ?.closest('.field, .multi-checkboxes, fieldset');
        if (!container) return;
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        for (const cb of checkboxes) {
          const cbLabel = cb.closest('label')?.textContent?.trim().toLowerCase() ?? '';
          if (values.some((v) => cbLabel.includes(v))) {
            if (!cb.checked) {
              cb.click();
              cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      }, field.label, selectedValues).catch(() => {});
    } else if (field.inputType === 'text' || field.inputType === 'textarea' ||
               field.inputType === 'tel' || field.inputType === 'email') {
      await fillByLabel(page, field.label, val).catch(() => {});
    }
  }

  // LinkedIn URL shortcut
  const linkedinUrl = fv(payload, 'linkedin_url');
  if (linkedinUrl) {
    await fillByLabel(page, 'linkedin', linkedinUrl).catch(() => {});
  }

  await uploadResume(page, payload, resumeBase64);

  // Submit and wait for confirmation — throws on detected failure
  const clicked = await clickSubmit(page);
  if (!clicked) {
    throw new Error('Could not find submit button on Greenhouse form');
  }

  // Wait for Greenhouse confirmation page or success indicators
  const confirmed = await page.waitForFunction(
    () => document.location.href.includes('confirmation') ||
          !!document.querySelector('.confirmation, #confirmation, [data-confirm], .application-confirmation') ||
          (document.body?.textContent?.includes('application has been received') ?? false) ||
          (document.body?.textContent?.includes('Thank you for applying') ?? false) ||
          (document.body?.textContent?.includes('successfully submitted') ?? false),
    { timeout: 12000 },
  ).then(() => true).catch(() => false);

  if (!confirmed) {
    // Only throw if there are VISIBLE error elements with actual text content
    const hasError = await page.evaluate(() => {
      const errorEls = Array.from(document.querySelectorAll(
        '.error-message, .field-error, #error_explanation, [class*="validation-error"], .alert-danger',
      )) as HTMLElement[];
      return errorEls.some((el) => {
        const text = el.textContent?.trim() ?? '';
        const style = window.getComputedStyle(el);
        return text.length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    }).catch(() => false);
    if (hasError) {
      throw new Error('Greenhouse form submission failed — validation errors detected');
    }
    // No confirmation and no explicit error — treat as success
  }
}

async function fillWorkday(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  try {
    await page.waitForSelector('[data-automation-id="applyButton"]', { timeout: 6000 });
    const applyBtn = await page.$('[data-automation-id="applyButton"]');
    if (applyBtn) {
      await applyBtn.click();
      // Wait for the apply form to appear rather than waiting for navigation
      await page.waitForSelector('[data-automation-id="legalNameSection_firstName"]', { timeout: 8000 }).catch(() => {});
    }
  } catch { /* continue */ }

  await trySelectors(page, ['[data-automation-id="legalNameSection_firstName"]', 'input[name*="firstName"]'], fv(payload, 'first_name'));
  await trySelectors(page, ['[data-automation-id="legalNameSection_lastName"]', 'input[name*="lastName"]'], fv(payload, 'last_name'));
  await trySelectors(page, ['[data-automation-id="email"]', 'input[type="email"]'], fv(payload, 'email'));
  await trySelectors(page, ['[data-automation-id="phone"]', 'input[type="tel"]'], fv(payload, 'phone'));
  await uploadResume(page, payload, resumeBase64);
  if (payload.coverLetter) {
    await trySelectors(page, ['[data-automation-id="coverLetter"]', 'textarea[name*="cover"]'], payload.coverLetter);
  }
  await clickSubmit(page);
}

async function fillLinkedIn(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  // Pre-resolve failed — find external apply URL in live DOM
  let externalApplyUrl: string | null = null;

  const externalApplySelectors = [
    'a[data-tracking-control-name="public_jobs_apply-link-offsite"]',
    'a[data-tracking-control-name="public_jobs_apply-link-offsite_sign-up-modal"]',
    'a.apply-button[href]',
    'a[href*="/apply"][target="_blank"]',
    'a[href]:not([href*="linkedin.com"])[class*="apply" i]',
  ];

  for (const sel of externalApplySelectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const href = await page.evaluate((node) => (node as HTMLAnchorElement).href, el) as string;
      if (href && !href.includes('linkedin.com')) {
        externalApplyUrl = href;
        break;
      }
    } catch { /* continue */ }
  }

  if (!externalApplyUrl) {
    // Fall back to Easy Apply modal
    try {
      const easyApply = await page.$('.jobs-apply-button, button[aria-label*="Easy Apply" i]');
      if (easyApply) {
        await easyApply.click();
        await page.waitForSelector('input[name="firstName"], input[id*="first"]', { timeout: 4000 }).catch(() => {});
        await trySelectors(page, ['input[name="firstName"]', 'input[id*="first"]'], fv(payload, 'first_name'));
        await trySelectors(page, ['input[name="lastName"]', 'input[id*="last"]'], fv(payload, 'last_name'));
        await trySelectors(page, ['input[type="email"]'], fv(payload, 'email'));
        await trySelectors(page, ['input[type="tel"]'], fv(payload, 'phone'));
        await uploadResume(page, payload, resumeBase64);
        for (let step = 0; step < 8; step++) {
          let advanced = false;
          for (const sel2 of ['button[aria-label="Continue to next step"]', 'footer button:last-of-type']) {
            try {
              const btn = await page.$(sel2);
              if (btn) {
                const text = await page.evaluate((el) => (el as HTMLElement).textContent ?? '', btn) as string;
                await btn.click();
                if (text.toLowerCase().includes('submit')) return;
                // Wait for next step to render instead of fixed sleep
                await page.waitForFunction(
                  (prevText) => {
                    const btns = Array.from(document.querySelectorAll('footer button'));
                    return btns.some((b) => b.textContent !== prevText);
                  },
                  { timeout: 3000 },
                  text,
                ).catch(() => {});
                advanced = true;
                break;
              }
            } catch { /* continue */ }
          }
          if (!advanced) break;
        }
      }
    } catch { /* continue */ }
    return;
  }

  // Navigate to external ATS — skip LinkedIn entirely
  await page.goto(externalApplyUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const landedUrl = page.url();
  const detectedAts = detectAtsFromUrl(landedUrl);
  const redirectedPayload: ApplyPayload = { ...payload, applyUrl: landedUrl, atsType: detectedAts };

  switch (detectedAts) {
    case 'workday': await fillWorkday(page, redirectedPayload, resumeBase64); break;
    case 'icims':   await fillIcims(page, redirectedPayload, resumeBase64);   break;
    case 'taleo':   await fillTaleo(page, redirectedPayload, resumeBase64);   break;
    default:        await fillGenericForm(page, redirectedPayload, resumeBase64); break;
  }
}

async function fillIndeed(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  await trySelectors(page, ['input[name="applicant.name"]', 'input[id*="name"]'], fv(payload, 'first_name') + ' ' + fv(payload, 'last_name'));
  await trySelectors(page, ['input[name="applicant.emailAddress"]', 'input[type="email"]'], fv(payload, 'email'));
  await trySelectors(page, ['input[name="applicant.phoneNumber"]', 'input[type="tel"]'], fv(payload, 'phone'));
  await uploadResume(page, payload, resumeBase64);
  if (payload.coverLetter) {
    await trySelectors(page, ['textarea[name*="cover"]', '#coverletter'], payload.coverLetter);
  }
  await clickSubmit(page);
}

async function fillIcims(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  await trySelectors(page, ['input[name*="firstName"]', 'input[id*="firstName"]'], fv(payload, 'first_name'));
  await trySelectors(page, ['input[name*="lastName"]', 'input[id*="lastName"]'], fv(payload, 'last_name'));
  await trySelectors(page, ['input[type="email"]', 'input[name*="email"]'], fv(payload, 'email'));
  await trySelectors(page, ['input[type="tel"]', 'input[name*="phone"]'], fv(payload, 'phone'));
  await uploadResume(page, payload, resumeBase64);
  if (payload.coverLetter) {
    await trySelectors(page, ['textarea[name*="cover"]', 'textarea[id*="cover"]'], payload.coverLetter);
  }
  await clickSubmit(page);
}

async function fillTaleo(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  await trySelectors(page, ['input[id*="firstName"]', 'input[name*="firstName"]'], fv(payload, 'first_name'));
  await trySelectors(page, ['input[id*="lastName"]', 'input[name*="lastName"]'], fv(payload, 'last_name'));
  await trySelectors(page, ['input[type="email"]', 'input[id*="email"]'], fv(payload, 'email'));
  await trySelectors(page, ['input[type="tel"]', 'input[id*="phone"]'], fv(payload, 'phone'));
  await uploadResume(page, payload, resumeBase64);
  await clickSubmit(page);
}

async function fillGenericForm(page: Page, payload: ApplyPayload, resumeBase64: string | null): Promise<void> {
  const mappings: Array<{ key: string; selectors: string[]; labels: string[] }> = [
    { key: 'first_name',   selectors: ['input[name*="first"]',    'input[id*="first"]'],    labels: ['first name', 'first'] },
    { key: 'last_name',    selectors: ['input[name*="last"]',     'input[id*="last"]'],     labels: ['last name', 'surname'] },
    { key: 'email',        selectors: ['input[type="email"]',     'input[name*="email"]'],  labels: ['email'] },
    { key: 'phone',        selectors: ['input[type="tel"]',       'input[name*="phone"]'],  labels: ['phone', 'mobile'] },
    { key: 'linkedin_url', selectors: ['input[name*="linkedin"]', 'input[id*="linkedin"]'], labels: ['linkedin'] },
    { key: 'github_url',   selectors: ['input[name*="github"]',   'input[id*="github"]'],   labels: ['github'] },
    { key: 'website_url',  selectors: ['input[name*="website"]',  'input[name*="portfolio"]'], labels: ['website', 'portfolio'] },
  ];

  for (const { key, selectors, labels } of mappings) {
    const value = fv(payload, key);
    if (!value) continue;
    const filled = await trySelectors(page, selectors, value);
    if (!filled) {
      for (const label of labels) {
        const ok = await fillByLabel(page, label, value);
        if (ok) break;
      }
    }
  }

  if (payload.coverLetter) {
    const ok = await trySelectors(page, ['textarea[name*="cover"]', 'textarea[id*="cover"]', 'textarea'], payload.coverLetter);
    if (!ok) await fillByLabel(page, 'cover letter', payload.coverLetter);
  }

  await uploadResume(page, payload, resumeBase64);
  await clickSubmit(page);
}
