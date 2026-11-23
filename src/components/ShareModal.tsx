import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  Link2Off,
  Loader2,
  Pencil,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../lib/api";
import type { SharePermission, WorkspaceRecord } from "../types/workspace";

interface ShareModalProps {
  open: boolean;
  workspace: WorkspaceRecord | null;
  user: AuthUser | null;
  onClose: () => void;
  onConfigureShare: (
    id: string,
    config: {
      enabled: boolean;
      permission?: SharePermission;
      regenerate?: boolean;
    },
  ) => Promise<WorkspaceRecord>;
  onOpenAuth: () => void;
  onNotify: (
    text: string,
    tone?: "info" | "success" | "warning" | "error",
  ) => void;
}

export function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return `?share=${token}`;
  const url = new URL(window.location.href);
  url.searchParams.set("share", token);
  return url.toString();
}

export function ShareModal({
  open,
  workspace,
  user,
  onClose,
  onConfigureShare,
  onOpenAuth,
  onNotify,
}: ShareModalProps) {
  const [selectedPermission, setSelectedPermission] = useState<SharePermission>(
    workspace?.sharePermission ?? "readonly",
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedPermission(workspace?.sharePermission ?? "readonly");
    setCopied(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, workspace?.id, workspace?.sharePermission, onClose]);

  const shareUrl = useMemo(() => {
    if (!workspace?.shareEnabled || !workspace.shareToken) return "";
    return buildShareUrl(workspace.shareToken);
  }, [workspace?.shareEnabled, workspace?.shareToken]);

  if (!open || !workspace) return null;

  const isCloud =
    workspace.storageMode === "cloud" && Boolean(workspace.remoteId);
  const isShareActive = Boolean(workspace.shareEnabled && workspace.shareToken);

  const handleEnableOrUpdate = async (
    nextPermission: SharePermission,
    regenerate = false,
  ) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBusy(true);
    try {
      await onConfigureShare(workspace.id, {
        enabled: true,
        permission: nextPermission,
        regenerate,
      });
      setSelectedPermission(nextPermission);
      onNotify(
        regenerate
          ? "Link bagikan baru berhasil dibuat."
          : isShareActive
            ? `Izin akses diubah ke ${nextPermission === "contributor" ? "Contributor (Read & Write)" : "Read Only (Preview)"}.`
            : "Link bagikan berhasil diaktifkan.",
        "success",
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : "Gagal memperbarui pengaturan share.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await onConfigureShare(workspace.id, {
        enabled: false,
      });
      onNotify("Link bagikan dinonaktifkan.", "info");
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : "Gagal menonaktifkan link bagikan.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onNotify("Link preview disalin ke clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify(
        "Gagal menyalin link. Salin secara manual dari kotak link.",
        "warning",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#e5e7eb] bg-white p-6 text-[#1b1b1f] shadow-2xl dark:border-[#31303b] dark:bg-[#232329] dark:text-[#e3e3e8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6965db]/12 text-[#6965db]">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-base font-semibold">
                Bagikan Link Preview
              </h2>
              <p className="line-clamp-1 text-xs text-[#6b7280] dark:text-[#9b9b9f]">
                {workspace.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog bagikan"
            className="cursor-pointer rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pilihan Permission */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-[#374151] dark:text-[#d4d4dc]">
            Izin Akses Link
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSelectedPermission("readonly");
                if (isShareActive && workspace.sharePermission !== "readonly") {
                  void handleEnableOrUpdate("readonly");
                }
              }}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition disabled:opacity-60 ${
                selectedPermission === "readonly"
                  ? "border-[#6965db] bg-[#6965db]/8 ring-1 ring-[#6965db]/40"
                  : "border-[#e5e7eb] hover:border-[#6965db]/60 dark:border-[#31303b] dark:hover:border-[#6965db]/60"
              }`}
            >
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[#6965db]" />
              <div>
                <div className="text-xs font-semibold">Read Only (Preview)</div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280] dark:text-[#9b9b9f]">
                  Hanya baca. Pengunjung bisa melihat, zoom, dan ekspor tanpa
                  mengedit.
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSelectedPermission("contributor");
                if (
                  isShareActive &&
                  workspace.sharePermission !== "contributor"
                ) {
                  void handleEnableOrUpdate("contributor");
                }
              }}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition disabled:opacity-60 ${
                selectedPermission === "contributor"
                  ? "border-[#6965db] bg-[#6965db]/8 ring-1 ring-[#6965db]/40"
                  : "border-[#e5e7eb] hover:border-[#6965db]/60 dark:border-[#31303b] dark:hover:border-[#6965db]/60"
              }`}
            >
              <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-xs font-semibold">
                  Contributor (Read & Write)
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280] dark:text-[#9b9b9f]">
                  Bisa melihat, mengedit elemen, dan menyimpan perubahan ke
                  kanvas ini.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Status & Kontrol Link */}
        <div className="mt-5">
          {!user ? (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4 dark:border-[#31303b] dark:bg-[#18181d]">
              <p className="text-xs leading-relaxed text-[#4b5563] dark:text-[#b4b4c0]">
                Untuk membuat link preview yang dapat diakses orang lain, masuk
                ke akun Database terlebih dahulu. Kanvas lokal Anda akan
                otomatis disinkronkan ke Database.
              </p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#5b57d1]"
              >
                <Database className="h-3.5 w-3.5" />
                Masuk Akun Database & Buat Link
              </button>
            </div>
          ) : isShareActive ? (
            <div className="space-y-3 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4 dark:border-[#31303b] dark:bg-[#18181d]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Link Aktif (
                  {workspace.sharePermission === "contributor"
                    ? "Contributor · Read & Write"
                    : "Read Only · Preview"}
                  )
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void handleEnableOrUpdate(selectedPermission, true)
                  }
                  title="Buat token link baru dan cabut link lama"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#6b7280] transition hover:bg-black/5 hover:text-[#1b1b1f] disabled:opacity-50 dark:text-[#9b9b9f] dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset Link
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  aria-label="URL link bagikan"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-[#d1d5db] bg-white px-2.5 py-2 font-mono text-[11px] text-[#1b1b1f] outline-none dark:border-[#3e3d4a] dark:bg-[#232329] dark:text-[#e3e3e8]"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#5b57d1]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Salin
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#6965db] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Buka Preview di Tab Baru
                </a>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDisable()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                  Nonaktifkan Link
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4 dark:border-[#31303b] dark:bg-[#18181d]">
              <p className="text-xs leading-relaxed text-[#4b5563] dark:text-[#b4b4c0]">
                {isCloud
                  ? "Link bagikan belum aktif untuk kanvas ini."
                  : "Kanvas ini masih tersimpan di Lokal (IndexedDB). Aktifkan link untuk menyimpannya ke Database dan membuat URL preview."}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleEnableOrUpdate(selectedPermission)}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#5b57d1] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {isCloud
                  ? "Aktifkan Share Link"
                  : "Simpan ke Database & Aktifkan Link"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
