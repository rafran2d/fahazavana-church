import type { TokenPair } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';
const STORAGE_KEY = 'fahazavana.admin.session';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Erreur API au format RFC 7807 (ProblemDetailsFilter côté NestJS). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function problemMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (Array.isArray(detail)) return detail.map(String).join(' · ');
    if (typeof detail === 'string' && detail) return detail;
  }
  if (status === 0) return "Impossible de joindre l'API";
  return `Erreur ${status}`;
}

// Les jetons sont gardés dans localStorage : simple pour le MVP. Une V2 pourra passer
// le refresh token en cookie httpOnly côté API.
let tokens: Tokens | null = readStored();
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

function readStored(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(next: Tokens | null) {
  tokens = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : la session reste en mémoire */
  }
}

export const hasTokens = () => tokens !== null;
export const currentRefreshToken = () => tokens?.refreshToken ?? null;

export function onUnauthorized(cb: () => void) {
  onSessionLost = cb;
}

/** Rotation du refresh token, mutualisée si plusieurs requêtes échouent en même temps. */
function refresh(): Promise<boolean> {
  if (!tokens) return Promise.resolve(false);
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      });
      if (!res.ok) return false;
      const pair = (await res.json()) as TokenPair;
      setTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, problemMessage(null, 0));
  }

  if (res.status === 401 && retry && tokens && !path.startsWith('/auth/')) {
    if (await refresh()) return request<T>(method, path, body, false);
    setTokens(null);
    onSessionLost?.();
  }

  if (!res.ok) {
    const payload: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, problemMessage(payload, res.status));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
