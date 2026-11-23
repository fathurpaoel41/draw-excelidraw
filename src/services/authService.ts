import {
  apiRequest,
  clearAuthSession,
  getStoredAccessToken,
  getStoredUser,
  saveAuthSession,
  type AuthSession,
  type AuthUser,
} from "../lib/api";

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ username, password }),
  });
  saveAuthSession(session);
  return session;
}

export async function register(
  username: string,
  password: string,
): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>("/api/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ username, password }),
  });
  saveAuthSession(session);
  return session;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (!getStoredAccessToken()) return null;
  try {
    return await apiRequest<AuthUser>("/api/auth/me", { method: "GET" });
  } catch {
    return null;
  }
}

export function logout(): void {
  clearAuthSession();
}

export function getCachedUser(): AuthUser | null {
  return getStoredUser();
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredAccessToken() && getStoredUser());
}
