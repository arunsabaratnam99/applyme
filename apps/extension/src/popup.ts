import type { MessageType, QueueItem } from './types.js';

const DASHBOARD_URL = 'https://applyme.ca/queue';

function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

async function getToken(): Promise<string | null> {
  const data = await chrome.storage.sync.get('authToken');
  return (data['authToken'] as string | undefined) ?? null;
}

async function saveToken(token: string): Promise<void> {
  await chrome.storage.sync.set({ authToken: token });
}

async function clearToken(): Promise<void> {
  await chrome.storage.sync.remove('authToken');
}

function renderQueue(items: QueueItem[]): void {
  const list = $('queue-list');
  if (items.length === 0) {
    list.innerHTML = '<div class="empty">No pending autofills.<br>Apply to jobs from the dashboard.</div>';
    return;
  }
  list.innerHTML = items
    .slice(0, 8)
    .map((item) => {
      const company = item.resumeData ? '' : '';
      const avatar = (item.atsType ?? '??').slice(0, 2).toUpperCase();
      return `
        <div class="queue-item">
          <div class="queue-item-avatar">${avatar}</div>
          <div class="queue-item-body">
            <div class="queue-item-title">${escapeHtml(item.atsType)}</div>
            <div class="queue-item-sub">${escapeHtml(truncate(item.applyUrl, 38))}</div>
          </div>
          <button class="open-btn" data-url="${escapeAttr(item.applyUrl)}">Open</button>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll<HTMLButtonElement>('.open-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset['url'];
      if (url) chrome.tabs.create({ url });
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

async function loadQueue(): Promise<void> {
  chrome.runtime.sendMessage<MessageType>({ type: 'GET_QUEUE' }, (response) => {
    const res = response as { type: string; items: QueueItem[] };
    if (res?.type === 'QUEUE_RESULT') renderQueue(res.items);
  });
}

async function init(): Promise<void> {
  const token = await getToken();

  const authSection = $('auth-section');
  const mainSection = $('main-section');
  const statusDot = $('status-dot');

  if (!token) {
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
    statusDot.className = 'status-dot offline';
  } else {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
    statusDot.className = 'status-dot';
    loadQueue();
  }

  $('save-token-btn').addEventListener('click', async () => {
    const input = $('token-input') as HTMLInputElement;
    const val = input.value.trim();
    if (!val) return;
    await saveToken(val);
    init();
  });

  $('refresh-btn').addEventListener('click', () => loadQueue());

  $('dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  });

  $('disconnect-btn').addEventListener('click', async () => {
    await clearToken();
    init();
  });
}

document.addEventListener('DOMContentLoaded', init);
