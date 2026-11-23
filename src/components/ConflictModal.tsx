import { useState } from "react";
import type { ConflictState } from "../hooks/useWorkspace";

interface ConflictModalProps {
  conflict: ConflictState | null;
  onResolve: (strategy: "server" | "overwrite" | "copy") => Promise<void>;
  onDismiss: () => void;
}

export function ConflictModal({
  conflict,
  onResolve,
  onDismiss,
}: ConflictModalProps) {
  const [busy, setBusy] = useState(false);

  if (!conflict) return null;

  const { localWorkspace, serverWorkspace } = conflict;

  const handlePick = async (strategy: "server" | "overwrite" | "copy") => {
    setBusy(true);
    try {
      await onResolve(strategy);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 text-[#1b1b1f] shadow-2xl dark:border-[#31303b] dark:bg-[#232329] dark:text-[#e3e3e8]">
        <h2 id="conflict-modal-title" className="text-base font-semibold">
          Konflik Versi
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[#6b7280] dark:text-[#9b9b9f]">
          <strong>{localWorkspace.title}</strong> juga berubah di Database
          (server <code>v{serverWorkspace.versi}</code> vs lokal{" "}
          <code>v{localWorkspace.version}</code>).
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePick("server")}
            className="w-full cursor-pointer rounded-lg border border-[#e5e7eb] p-3 text-left transition hover:border-[#6965db] hover:bg-[#f1f0ff]/60 disabled:opacity-50 dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
          >
            <div className="text-xs font-semibold">Gunakan Versi Database</div>
            <div className="mt-0.5 text-[11px] text-[#6b7280] dark:text-[#9b9b9f]">
              Muat versi terbaru dari server.
            </div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePick("overwrite")}
            className="w-full cursor-pointer rounded-lg border border-[#e5e7eb] p-3 text-left transition hover:border-[#6965db] hover:bg-[#f1f0ff]/60 disabled:opacity-50 dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
          >
            <div className="text-xs font-semibold">
              Timpa dengan Versi Lokal
            </div>
            <div className="mt-0.5 text-[11px] text-[#6b7280] dark:text-[#9b9b9f]">
              Kirim perubahan di kanvas saat ini ke server.
            </div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePick("copy")}
            className="w-full cursor-pointer rounded-lg border border-[#e5e7eb] p-3 text-left transition hover:border-[#6965db] hover:bg-[#f1f0ff]/60 disabled:opacity-50 dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
          >
            <div className="text-xs font-semibold">Simpan Keduanya</div>
            <div className="mt-0.5 text-[11px] text-[#6b7280] dark:text-[#9b9b9f]">
              Simpan versi lokal sebagai salinan baru, lalu muat versi server.
            </div>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-[#6b7280] hover:bg-[#f3f4f6] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39]"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </div>
  );
}
