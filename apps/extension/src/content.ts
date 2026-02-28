import type { MessageType, QueueItem, ResumeData, AtsType } from './types.js';

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

// ─── Banner UI ────────────────────────────────────────────────────────────────

function showBanner(item: QueueItem): void {
  const existing = document.getElementById('applyme-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'applyme-banner';
  banner.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    background: #1d6fd4; color: #fff; border-radius: 10px;
    padding: 12px 16px; box-shadow: 0 4px 20px rgba(0,0,0,.25);
    font-family: system-ui, sans-serif; font-size: 13px; max-width: 300px;
    display: flex; flex-direction: column; gap: 8px;
  `;

  banner.innerHTML = `
    <div style="font-weight:600;font-size:14px;">ApplyMe Autofill Ready</div>
    <div style="opacity:.85;font-size:12px;">Detected ATS: ${item.atsType}</div>
    <div style="display:flex;gap:8px;margin-top:2px;">
      <button id="applyme-fill-btn" style="background:#fff;color:#1d6fd4;border:none;border-radius:6px;padding:5px 12px;font-weight:600;cursor:pointer;font-size:12px;">
        Fill form
      </button>
      <button id="applyme-dismiss-btn" style="background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;">
        Dismiss
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('applyme-fill-btn')?.addEventListener('click', () => {
    autofill(item.atsType, item.resumeData);
    banner.innerHTML = `<div style="font-weight:600;">✓ Form filled — review and submit</div>`;
    setTimeout(() => banner.remove(), 4000);
    chrome.runtime.sendMessage<MessageType>({
      type: 'AUTOFILL_DONE',
      itemId: item.id,
      success: true,
    });
  });

  document.getElementById('applyme-dismiss-btn')?.addEventListener('click', () => {
    banner.remove();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const ats = detectAts();
  if (ats === 'unknown') return;

  chrome.runtime.sendMessage<MessageType>({ type: 'GET_QUEUE' }, (response) => {
    const res = response as { type: string; items: QueueItem[] };
    if (res?.type !== 'QUEUE_RESULT') return;
    const match = res.items.find((i) => {
      try {
        const itemUrl = new URL(i.applyUrl);
        return itemUrl.hostname === location.hostname && location.href.includes(itemUrl.pathname.split('?')[0] ?? '');
      } catch {
        return false;
      }
    });
    if (match) showBanner(match);
  });
}

// Delay slightly to let SPA apps mount
setTimeout(() => init(), 1500);
