import type { MessageType, QueueItem, StorageState } from './types.js';

const DEFAULT_API_BASE = 'https://api.applyme.ca';
const SYNC_ALARM = 'applyme-sync';
const SYNC_INTERVAL_MINUTES = 5;

// ─── Alarm setup ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  syncQueue();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) syncQueue();
});

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: MessageType, _sender, sendResponse: (r: unknown) => void) => {
    switch (msg.type) {
      case 'GET_QUEUE':
        getQueue().then((items) => sendResponse({ type: 'QUEUE_RESULT', items }));
        return true;
      case 'GET_AUTH_TOKEN':
        getState().then((s) => sendResponse({ type: 'AUTH_TOKEN_RESULT', token: s.authToken }));
        return true;
      case 'AUTOFILL_DONE':
        handleAutofillDone(msg.itemId, msg.success, msg.error);
        return false;
    }
  },
);

// ─── Queue sync ───────────────────────────────────────────────────────────────

async function syncQueue(): Promise<void> {
  const state = await getState();
  if (!state.authToken) return;

  try {
    const res = await fetch(`${state.apiBase}/api/autofill-queue`, {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    if (!res.ok) return;
    const items = (await res.json()) as QueueItem[];
    await chrome.storage.local.set({ queue: items, lastSync: Date.now() });

    // Update badge with pending count
    const pending = items.filter((i) => i.atsType !== 'unknown');
    if (pending.length > 0) {
      chrome.action.setBadgeText({ text: String(pending.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#1d6fd4' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Network error — silent fail
  }
}

async function getQueue(): Promise<QueueItem[]> {
  const data = await chrome.storage.local.get('queue');
  return (data['queue'] as QueueItem[] | undefined) ?? [];
}

async function handleAutofillDone(itemId: string, success: boolean, error?: string): Promise<void> {
  const state = await getState();
  if (!state.authToken) return;

  const endpoint = success
    ? `/api/autofill-queue/${itemId}/complete`
    : `/api/autofill-queue/${itemId}/skip`;

  try {
    await fetch(`${state.apiBase}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.authToken}`,
        'Content-Type': 'application/json',
      },
      ...(error !== undefined ? { body: JSON.stringify({ error }) } : {}),
    });
    await syncQueue();
  } catch {
    // Silent fail
  }
}

async function getState(): Promise<StorageState> {
  const data = await chrome.storage.sync.get(['authToken', 'apiBase', 'lastSync']);
  return {
    authToken: (data['authToken'] as string | undefined) ?? null,
    apiBase: (data['apiBase'] as string | undefined) ?? DEFAULT_API_BASE,
    lastSync: (data['lastSync'] as number | undefined) ?? 0,
  };
}
