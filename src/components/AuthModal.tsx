import { LogOut, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser } from "../lib/api";

interface AuthModalProps {
  open: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<AuthUser>;
  onRegister: (username: string, password: string) => Promise<AuthUser>;
  onLogout: () => void;
  onAuthenticated?: () => Promise<void> | void;
}

export function AuthModal({
  open,
  user,
  onClose,
  onLogin,
  onRegister,
  onLogout,
  onAuthenticated,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(username.trim(), password);
      } else {
        await onRegister(username.trim(), password);
      }
      setPassword("");
      await onAuthenticated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autentikasi gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white p-6 text-[#1b1b1f] shadow-2xl dark:border-[#31303b] dark:bg-[#232329] dark:text-[#e3e3e8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="auth-modal-title" className="text-base font-semibold">
            Akun Database
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog akun"
            className="cursor-pointer rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-3.5 dark:border-[#31303b] dark:bg-[#18181d]">
              <p className="text-[11px] font-medium text-[#6b7280] dark:text-[#9b9b9f]">
                Masuk sebagai
              </p>
              <p className="mt-0.5 text-sm font-semibold">{user.username}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-[#e5e7eb] px-3.5 py-2 text-xs font-medium hover:bg-[#f5f5f9] dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 rounded-lg bg-[#f3f4f6] p-1 dark:bg-[#18181d]">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`cursor-pointer rounded-md py-1.5 text-xs font-medium transition ${
                  mode === "login"
                    ? "bg-white text-[#1b1b1f] shadow-xs dark:bg-[#2e2d39] dark:text-white"
                    : "text-[#6b7280] hover:text-[#1b1b1f] dark:text-[#9b9b9f]"
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`cursor-pointer rounded-md py-1.5 text-xs font-medium transition ${
                  mode === "register"
                    ? "bg-white text-[#1b1b1f] shadow-xs dark:bg-[#2e2d39] dark:text-white"
                    : "text-[#6b7280] hover:text-[#1b1b1f] dark:text-[#9b9b9f]"
                }`}
              >
                Daftar
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="auth-username"
                className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#c7c7d1]"
              >
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="fathur"
                className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#6965db] dark:border-[#3e3d4a] dark:bg-[#18181d]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#c7c7d1]"
              >
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === "register" ? 6 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#6965db] dark:border-[#3e3d4a] dark:bg-[#18181d]"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer rounded-lg bg-[#6965db] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#5b57d1] disabled:opacity-60"
              >
                {submitting
                  ? "Memproses..."
                  : mode === "login"
                    ? "Masuk"
                    : "Daftar & Masuk"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
