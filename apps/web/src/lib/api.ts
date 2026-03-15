declare const process: { env: Record<string, string | undefined> };
const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] ??
  process.env['NEXT_PUBLIC_API_BASE_URL'] ??
  'http://localhost:8787';

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
    const rawText = await res.text().catch(() => '');
    console.error('[api] error response', res.status, res.url, rawText);
    let message: string;
    try {
      const body = JSON.parse(rawText) as { error?: unknown; success?: boolean };
      if (typeof body.error === 'string') {
        message = body.error;
      } else if (body.error && typeof body.error === 'object') {
        const zodErr = body.error as { issues?: { message: string; path: (string | number)[] }[] };
        if (zodErr.issues?.length) {
          message = zodErr.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        } else {
          message = JSON.stringify(body.error);
        }
      } else {
        message = rawText || res.statusText;
      }
    } catch {
      message = rawText || res.statusText;
    }
    let parsedBody: Record<string, unknown> | undefined;
    try { parsedBody = JSON.parse(rawText) as Record<string, unknown>; } catch { /* ignore */ }
    throw new ApiError(res.status, message, parsedBody);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: Record<string, unknown>,
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
