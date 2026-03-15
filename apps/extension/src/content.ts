import type { MessageType, QueueItem, AutofillProfile, ResumeData, AtsType } from './types.js';

// ─── Detect ATS from current URL ─────────────────────────────────────────────

function detectAts(): AtsType {
  const host = location.hostname;
  if (host.includes('ashbyhq.com')) return 'ashby';
  if (host.includes('lever.co')) return 'lever';
  if (host.includes('greenhouse.io')) return 'greenhouse';
  if (host.includes('workable.com')) return 'workable';
  if (host.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (host.includes('jobvite.com')) return 'jobvite';
  if (host.includes('icims.com')) return 'icims';
  if (host.includes('taleo.net')) return 'taleo';
  if (host.includes('successfactors.com')) return 'successfactors';
  if (host.includes('jobs.gc.ca') || host.includes('emplois.gc.ca')) return 'jobbank_ca';
  return 'unknown';
}

// ─── Field fill helpers ───────────────────────────────────────────────────────

function fillInput(selector: string, value: string): boolean {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!el) return false;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.value = value;
  }
  return true;
}

function fillSelect(selector: string, value: string): boolean {
  const el = document.querySelector<HTMLSelectElement>(selector);
  if (!el) return false;
  const opt = Array.from(el.options).find(
    (o) => o.value.toLowerCase() === value.toLowerCase() || o.text.toLowerCase().includes(value.toLowerCase()),
  );
  if (opt) {
    el.value = opt.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function fillByLabel(labelText: string, value: string): boolean {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((l) => l.textContent?.toLowerCase().includes(labelText.toLowerCase()));
  if (!label) return false;
  const id = label.getAttribute('for');
  const input = id
    ? document.getElementById(id)
    : label.querySelector('input, textarea, select');
  if (!input) return false;
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    fillInput(`#${input.id}` || '', value);
    return true;
  }
  return false;
}

// ─── ATS-specific fillers ─────────────────────────────────────────────────────

function fillAshby(data: ResumeData): void {
  fillInput('input[name="name"], input[placeholder*="name" i]', `${data.firstName} ${data.lastName}`);
  fillInput('input[name="email"], input[type="email"]', data.email);
  fillInput('input[name="phone"], input[type="tel"]', data.phone);
  fillInput('input[name="location"], input[placeholder*="location" i], input[placeholder*="city" i]', data.location);
  fillInput('input[name="linkedin"], input[placeholder*="linkedin" i]', data.linkedinUrl);
  fillInput('input[name="github"], input[placeholder*="github" i]', data.githubUrl);
  fillInput('input[name="website"], input[placeholder*="website" i], input[placeholder*="portfolio" i]', data.websiteUrl);
}

function fillLever(data: ResumeData): void {
  fillInput('#name, input[name="name"]', `${data.firstName} ${data.lastName}`);
  fillInput('#email, input[name="email"]', data.email);
  fillInput('#phone, input[name="phone"]', data.phone);
  fillInput('#org, input[name="org"]', data.workExperience[0]?.company ?? '');
  fillInput('input[name="urls[LinkedIn]"], input[data-qa="linkedin-input"]', data.linkedinUrl);
  fillInput('input[name="urls[GitHub]"], input[data-qa="github-input"]', data.githubUrl);
  fillInput('input[name="urls[Portfolio]"]', data.websiteUrl);
}

function fillGreenhouse(data: ResumeData): void {
  fillInput('#first_name', data.firstName);
  fillInput('#last_name', data.lastName);
  fillInput('#email', data.email);
  fillInput('#phone', data.phone);
  fillInput('input[name="job_application[location]"]', data.location);
  fillInput('#linkedin_profile, input[name*="linkedin"]', data.linkedinUrl);
  fillInput('input[name*="github"]', data.githubUrl);
  fillInput('input[name*="website"], input[name*="portfolio"]', data.websiteUrl);
}

function fillWorkable(data: ResumeData): void {
  fillByLabel('first name', data.firstName);
  fillByLabel('last name', data.lastName);
  fillByLabel('email', data.email);
  fillByLabel('phone', data.phone);
  fillByLabel('location', data.location);
  fillByLabel('linkedin', data.linkedinUrl);
}

function fillGeneric(data: ResumeData): void {
  // Try common field patterns
  const firstName = `${data.firstName}`;
  const lastName = `${data.lastName}`;
  const fullName = `${firstName} ${lastName}`;

  // First/last name split
  fillInput('input[name*="first" i][name*="name" i], input[id*="first" i][id*="name" i]', firstName) ||
    fillByLabel('first name', firstName);
  fillInput('input[name*="last" i][name*="name" i], input[id*="last" i][id*="name" i]', lastName) ||
    fillByLabel('last name', lastName);

  // Full name fallback
  fillInput('input[name="name"], input[id="name"], input[placeholder*="full name" i]', fullName) ||
    fillByLabel('full name', fullName) ||
    fillByLabel('name', fullName);

  fillInput('input[type="email"], input[name*="email" i]', data.email) ||
    fillByLabel('email', data.email);
  fillInput('input[type="tel"], input[name*="phone" i]', data.phone) ||
    fillByLabel('phone', data.phone);
  fillInput('input[name*="location" i], input[name*="city" i]', data.location) ||
    fillByLabel('location', data.location) ||
    fillByLabel('city', data.location);
  fillInput('input[name*="linkedin" i]', data.linkedinUrl) ||
    fillByLabel('linkedin', data.linkedinUrl);
  fillInput('input[name*="github" i]', data.githubUrl) ||
    fillByLabel('github', data.githubUrl);
  fillInput('input[name*="website" i], input[name*="portfolio" i]', data.websiteUrl) ||
    fillByLabel('website', data.websiteUrl) ||
    fillByLabel('portfolio', data.websiteUrl);
}

// ─── Dispatch to correct filler ──────────────────────────────────────────────

function autofill(atsType: AtsType, data: ResumeData): void {
  switch (atsType) {
    case 'ashby': fillAshby(data); break;
    case 'lever': fillLever(data); break;
    case 'greenhouse': fillGreenhouse(data); break;
    case 'workable': fillWorkable(data); break;
    default: fillGeneric(data); break;
  }
}

// ─── fieldMap-based fill ──────────────────────────────────────────────────────

function fillFromFieldMap(fields: Array<{ fieldKey: string; selector: string | null; label: string; profileValue: string; inputType: string }>): void {
  for (const field of fields) {
    if (!field.profileValue) continue;
    let filled = false;
    if (field.selector) {
      filled = fillInput(field.selector, field.profileValue);
    }
    if (!filled) {
      filled = fillByLabel(field.label, field.profileValue);
    }
    // Fallback: try common field key patterns
    if (!filled) {
      const selectors = fieldKeyToSelectors(field.fieldKey);
      for (const sel of selectors) {
        if (fillInput(sel, field.profileValue)) { filled = true; break; }
      }
    }
  }
}

function fieldKeyToSelectors(fieldKey: string): string[] {
  const map: Record<string, string[]> = {
    first_name: ['input[name*="first" i][name*="name" i]', 'input[id*="first" i][id*="name" i]', '#first_name', '#firstName'],
    last_name:  ['input[name*="last" i][name*="name" i]',  'input[id*="last" i][id*="name" i]',  '#last_name',  '#lastName'],
    email:      ['input[type="email"]', 'input[name*="email" i]'],
    phone:      ['input[type="tel"]',   'input[name*="phone" i]'],
    location:   ['input[name*="location" i]', 'input[name*="city" i]'],
    linkedin_url: ['input[name*="linkedin" i]'],
    github_url:   ['input[name*="github" i]'],
    website_url:  ['input[name*="website" i]', 'input[name*="portfolio" i]'],
    cover_letter: ['textarea[name*="cover" i]', 'textarea[id*="cover" i]', 'textarea'],
    visa_auth:    ['select[name*="visa" i]', 'input[name*="visa" i]'],
  };
  return map[fieldKey] ?? [];
}

// ─── Scan for unfilled required fields ───────────────────────────────────────

function scanUnfilledRequired(): Array<{ fieldKey: string; label: string; el: HTMLElement }> {
  const results: Array<{ fieldKey: string; label: string; el: HTMLElement }> = [];
  const required = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input[required], textarea[required], select[required], [aria-required="true"]',
  );
  for (const el of Array.from(required)) {
    if (el instanceof HTMLInputElement && el.type === 'file') continue;
    const val = el instanceof HTMLSelectElement ? el.value : el.value;
    if (val.trim()) continue;
    const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : el.closest('label');
    const placeholder = 'placeholder' in el ? (el as HTMLInputElement).placeholder : '';
    const label = labelEl?.textContent?.trim() ?? placeholder ?? el.name ?? 'Unknown field';
    const fieldKey = (el.name || el.id || label).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    results.push({ fieldKey, label, el });
  }
  return results;
}

// ─── Auto-submit ──────────────────────────────────────────────────────────────

function tryAutoSubmit(): boolean {
  const submitBtn = document.querySelector<HTMLButtonElement | HTMLInputElement>(
    'button[type="submit"], input[type="submit"], button[data-qa*="submit" i], button[aria-label*="submit" i]',
  );
  if (!submitBtn) return false;
  submitBtn.click();
  return true;
}

// ─── Status banner ────────────────────────────────────────────────────────────

function showStatusBanner(message: string, type: 'success' | 'warning' | 'error'): void {
  const existing = document.getElementById('applyme-banner');
  if (existing) existing.remove();

  const colors = { success: '#16a34a', warning: '#d97706', error: '#dc2626' };
  const banner = document.createElement('div');
  banner.id = 'applyme-banner';
  banner.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    background: ${colors[type]}; color: #fff; border-radius: 10px;
    padding: 12px 16px; box-shadow: 0 4px 20px rgba(0,0,0,.25);
    font-family: system-ui, sans-serif; font-size: 13px; max-width: 340px;
    display: flex; flex-direction: column; gap: 6px;
  `;
  banner.innerHTML = `
    <div style="font-weight:600;font-size:14px;">ApplyMe</div>
    <div style="opacity:.9;font-size:12px;line-height:1.4;">${message}</div>
    <button id="applyme-dismiss-btn" style="margin-top:4px;align-self:flex-start;background:rgba(255,255,255,.25);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Dismiss</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('applyme-dismiss-btn')?.addEventListener('click', () => banner.remove());
  if (type === 'success') setTimeout(() => banner.remove(), 5000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const ats = detectAts();
  if (ats === 'unknown') return;

  chrome.runtime.sendMessage<MessageType>({ type: 'GET_QUEUE' }, (queueResp) => {
    const qRes = queueResp as { type: string; items: QueueItem[] };
    if (qRes?.type !== 'QUEUE_RESULT') return;

    const match = qRes.items.find((i) => {
      try {
        const itemUrl = new URL(i.applyUrl);
        return itemUrl.hostname === location.hostname && location.href.includes(itemUrl.pathname.split('?')[0] ?? '');
      } catch {
        return false;
      }
    });
    if (!match) return;

    // Check per-ATS enabled
    chrome.runtime.sendMessage<MessageType>({ type: 'GET_PROFILES' }, (profilesResp) => {
      const pRes = profilesResp as { type: string; profiles: AutofillProfile[] };
      const profiles: AutofillProfile[] = pRes?.type === 'PROFILES_RESULT' ? pRes.profiles : [];
      const atsProfile = profiles.find((p) => p.atsType === match.atsType);
      if (atsProfile && !atsProfile.enabled) return;

      // Run autofill
      try {
        // Fill via fieldMap (server-supplied values)
        if (match.fieldMap?.fields?.length) {
          fillFromFieldMap(match.fieldMap.fields);
        } else {
          // Legacy: fall back to resumeData-based fill
          autofill(match.atsType, match.resumeData ?? {} as ReturnType<typeof buildResumeDataFromFieldMap>);
        }

        // Fill unknown fields from profile answers
        if (atsProfile?.unknownFields) {
          for (const uf of atsProfile.unknownFields) {
            if (!uf.userValue) continue;
            fillByLabel(uf.label, uf.userValue) || fillInput(`[name*="${uf.fieldKey}" i]`, uf.userValue);
          }
        }

        // Scan for remaining unfilled required fields
        const unfilled = scanUnfilledRequired();
        for (const uf of unfilled) {
          chrome.runtime.sendMessage<MessageType>({
            type: 'REPORT_UNKNOWN_FIELD',
            itemId: match.id,
            fieldKey: uf.fieldKey,
            label: uf.label,
          });
        }

        if (unfilled.length === 0) {
          showStatusBanner('Form filled ✓ — submitting…', 'success');
          setTimeout(() => {
            const submitted = tryAutoSubmit();
            if (submitted) {
              chrome.runtime.sendMessage<MessageType>({ type: 'AUTOFILL_DONE', itemId: match.id, success: true });
            } else {
              showStatusBanner('Form filled ✓ — please review and click Submit.', 'success');
              chrome.runtime.sendMessage<MessageType>({ type: 'AUTOFILL_DONE', itemId: match.id, success: true });
            }
          }, 800);
        } else {
          showStatusBanner(
            `Form filled — ${unfilled.length} required field${unfilled.length > 1 ? 's' : ''} need attention. Review and submit when ready.`,
            'warning',
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showStatusBanner(`AutoFill error: ${msg}`, 'error');
        chrome.runtime.sendMessage<MessageType>({ type: 'AUTOFILL_ERROR', itemId: match.id, errorDetail: msg });
      }
    });
  });
}

function buildResumeDataFromFieldMap(_item: QueueItem): ResumeData {
  return { firstName: '', lastName: '', email: '', phone: '', location: '', linkedinUrl: '', githubUrl: '', websiteUrl: '', summary: '', workExperience: [], education: [], skills: [] };
}

// Delay slightly to let SPA apps mount
setTimeout(() => init(), 1500);
