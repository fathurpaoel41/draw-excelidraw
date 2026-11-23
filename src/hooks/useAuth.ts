import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "../lib/api";
import { IS_CLOUD_ENABLED } from "../lib/config";
import * as authService from "../services/authService";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() =>
    IS_CLOUD_ENABLED ? authService.getCachedUser() : null,
  );
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    if (!IS_CLOUD_ENABLED) return;
    let active = true;
    if (!authService.isAuthenticated()) return;
    setChecking(true);
    authService
      .fetchCurrentUser()
      .then((me) => {
        if (!active) return;
        if (me) setUser(me);
        else {
          authService.logout();
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const session = await authService.login(username, password);
    setUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const session = await authService.register(username, password);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: Boolean(user),
    checking,
    login,
    register,
    logout,
  };
}
