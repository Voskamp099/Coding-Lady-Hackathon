/**
 * Shared backend config — reads BACKEND_URL from env, defaults to localhost:8000.
 */
export const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * Proxy a request to the Python FastAPI backend.
 * Forwards method, headers, and body, and returns the response.
 */
export async function proxyToBackend(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Copy authorization if present
  if (init.headers) {
    const h = init.headers as Record<string, string>;
    if (h['Authorization']) headers['Authorization'] = h['Authorization'];
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  return res;
}
