export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const KEY_ACCESS = "draw_auth_access_token";
const KEY_REFRESH = "draw_auth_refresh_token";
const KEY_USER = "draw_auth_user";

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(KEY_ACCESS);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(KEY_REFRESH);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(KEY_USER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      "username" in parsed
    ) {
      return parsed as AuthUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(KEY_ACCESS, session.access_token);
  localStorage.setItem(KEY_REFRESH, session.refresh_token);
  localStorage.setItem(KEY_USER, JSON.stringify(session.user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
  localStorage.removeItem(KEY_USER);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        clearAuthSession();
        return null;
      }
      const json = (await res.json()) as { data?: AuthSession };
      if (!json.data?.access_token) {
        clearAuthSession();
        return null;
      }
      saveAuthSession(json.data);
      return json.data.access_token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers: extraHeaders, ...rest } = options;

  const buildHeaders = (token: string | null): Headers => {
    const h = new Headers(extraHeaders);
    if (rest.body && !h.has("content-type")) {
      h.set("content-type", "application/json");
    }
    if (auth && token) {
      h.set("authorization", `Bearer ${token}`);
    }
    return h;
  };

  let token = auth ? getStoredAccessToken() : null;
  let res = await fetch(path, { ...rest, headers: buildHeaders(token) });

  if (auth && res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      token = newToken;
      res = await fetch(path, { ...rest, headers: buildHeaders(token) });
    }
  }

  const payload = (await res.json().catch(() => null)) as {
    data?: T;
    error?: string;
  } | null;

  if (!res.ok) {
    throw new ApiError(
      payload?.error || `Permintaan gagal (${res.status})`,
      res.status,
      payload?.data,
    );
  }

  return payload?.data as T;
}
