import type { MessageType, AutofillProfile, StorageState } from './types.js';

const DEFAULT_API_BASE = 'https://api.applyme.ca';
const SYNC_ALARM = 'applyme-sync';
const SYNC_INTERVAL_MINUTES = 5;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_INTERVAL_MINUTES });
  syncProfiles();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) syncProfiles();
});

chrome.runtime.onMessage.addListener(
  (msg: MessageType, _sender, sendResponse: (r: unknown) => void) => {
    switch (msg.type) {
      case 'GET_PROFILES':
        getProfiles().then((profiles) => sendResponse({ type: 'PROFILES_RESULT', profiles }));
        return true;
      case 'GET_AUTH_TOKEN':
        getState().then((s) => sendResponse({ type: 'AUTH_TOKEN_RESULT', token: s.authToken }));
        return true;
      default:
        return false;
    }
  },
);

async function syncProfiles(): Promise<void> {
  const state = await getState();
  if (!state.authToken) return;

  try {
    const profilesRes = await fetch(`${state.apiBase}/api/autofill-profiles`, {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });

    if (profilesRes.ok) {
      const profiles = (await profilesRes.json()) as AutofillProfile[];
      await chrome.storage.local.set({ profiles, lastSync: Date.now() });
    }

    chrome.action.setBadgeText({ text: '' });
  } catch {
    // Network error — silent fail
  }
}

async function getProfiles(): Promise<AutofillProfile[]> {
  const data = await chrome.storage.local.get('profiles');
  return (data['profiles'] as AutofillProfile[] | undefined) ?? [];
}

async function getState(): Promise<StorageState> {
  const data = await chrome.storage.sync.get(['authToken', 'apiBase', 'lastSync']);
  return {
    authToken: (data['authToken'] as string | undefined) ?? null,
    apiBase: (data['apiBase'] as string | undefined) ?? DEFAULT_API_BASE,
    lastSync: (data['lastSync'] as number | undefined) ?? 0,
  };
}
