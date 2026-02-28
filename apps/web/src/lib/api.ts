declare const process: { env: Record<string, string | undefined> };
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8787';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const init: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const res = await fetch(`${API_BASE}${path}`, init);

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
      error?: string;
    };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function withBody(method: string, body?: unknown): RequestInit {
  if (body !== undefined) {
    return { method, body: JSON.stringify(body) };
  }
  return { method };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, withBody('POST', body)),
  put: <T>(path: string, body?: unknown) => request<T>(path, withBody('PUT', body)),
  patch: <T>(path: string, body?: unknown) => request<T>(path, withBody('PATCH', body)),
  delete: <T>(path: string, body?: unknown) => request<T>(path, withBody('DELETE', body)),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData, headers: {} }),
};
