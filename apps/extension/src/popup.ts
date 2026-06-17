const DASHBOARD_URL = 'https://applyme.ca/jobs';

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
  }

  $('save-token-btn').addEventListener('click', async () => {
    const input = $('token-input') as HTMLInputElement;
    const val = input.value.trim();
    if (!val) return;
    await saveToken(val);
    init();
  });

  $('dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
  });

  $('disconnect-btn').addEventListener('click', async () => {
    await clearToken();
    init();
  });
}

document.addEventListener('DOMContentLoaded', init);
