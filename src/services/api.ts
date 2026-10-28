import { getIdToken } from './firebase';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * fetch() wrapper for this app's own API. Adds the Firebase ID token when the
 * user is signed in and retries once with a refreshed token on 401.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async (forceRefresh: boolean) => {
    const token = await getIdToken(forceRefresh);
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(input, { ...init, headers });
  };
  let res = await send(false);
  if (res.status === 401) res = await send(true);
  return res;
}

/** JSON helper: throws ApiError with the server's message on non-2xx. */
export async function apiJson<T = any>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
