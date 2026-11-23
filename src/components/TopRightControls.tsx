import {
  AlertTriangle,
  Cloud,
  CloudOff,
  FileDown,
  Folder,
  HardDrive,
  ImageDown,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IS_CLOUD_ENABLED } from "../lib/config";
import type { SyncStatus, Theme, WorkspaceWithFiles } from "../types/workspace";

interface TopRightControlsProps {
  workspace: WorkspaceWithFiles | null;
  syncStatus: SyncStatus;
  isOnline: boolean;
  theme: Theme;
  exportingPng: boolean;
  onRename: (newTitle: string) => Promise<void>;
  onOpenDrawer: () => void;
  onExportPng: () => void;
  onOpenPdf: () => void;
  onQuickToggleStorage: () => void;
}

export function TopRightControls({
  workspace,
  syncStatus,
  isOnline,
  theme,
  exportingPng,
  onRename,
  onOpenDrawer,
  onExportPng,
  onOpenPdf,
  onQuickToggleStorage,
}: TopRightControlsProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(workspace?.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(workspace?.title ?? "");
  }, [workspace?.id, workspace?.title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = async () => {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && workspace && trimmed !== workspace.title) {
      await onRename(trimmed);
    } else {
      setDraftTitle(workspace?.title ?? "");
    }
  };

  const isDark = theme === "dark";
  const shellClass = isDark
    ? "bg-[#232329] text-[#e3e3e8] border-[#31303b] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
    : "bg-white text-[#1b1b1f] border-[#e5e7eb] shadow-[0_1px_5px_rgba(0,0,0,0.06)]";

  const btnClass = isDark
    ? "text-[#e3e3e8] hover:bg-[#2e2d39]"
    : "text-[#1b1b1f] hover:bg-[#f1f0ff]";

  const mutedText = isDark ? "text-[#9b9b9f]" : "text-[#6b7280]";

  const renderStorageStatus = () => {
    if (!workspace) return null;

    if (syncStatus === "saving") {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${mutedText}`}
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="hidden md:inline">Menyimpan</span>
        </span>
      );
    }

    if (!IS_CLOUD_ENABLED) {
      return (
        <span
          title="Tersimpan di browser (IndexedDB)"
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${mutedText}`}
        >
          <HardDrive className="h-3 w-3" />
          <span className="hidden md:inline">Lokal</span>
        </span>
      );
    }

    if (workspace.storageMode === "cloud") {
      if (syncStatus === "conflict") {
        return (
          <button
            type="button"
            onClick={onQuickToggleStorage}
            title="Konflik versi Database"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="hidden md:inline">Konflik</span>
          </button>
        );
      }

      if (!isOnline || syncStatus === "pending") {
        return (
          <button
            type="button"
            onClick={onQuickToggleStorage}
            title="Menunggu sinkronisasi Database"
            className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${mutedText} ${btnClass}`}
          >
            <CloudOff className="h-3 w-3" />
            <span className="hidden md:inline">Tertunda</span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={onQuickToggleStorage}
          title="Tersimpan di Database"
          className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${mutedText} ${btnClass}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <Cloud className="h-3 w-3" />
          <span className="hidden md:inline">DB</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onQuickToggleStorage}
        title="Tersimpan di IndexedDB (klik untuk simpan ke Database)"
        className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${mutedText} ${btnClass}`}
      >
        <HardDrive className="h-3 w-3" />
        <span className="hidden md:inline">Lokal</span>
      </button>
    );
  };

  return (
    <div
      className={`pointer-events-auto flex h-9 items-center gap-1 rounded-lg border px-2 transition-colors ${shellClass}`}
    >
      {workspace && (
        <div className="flex items-center gap-1 pr-0.5">
          {workspace.folder && (
            <button
              type="button"
              onClick={onOpenDrawer}
              title={`Folder: ${workspace.folder}`}
              className={`hidden cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium lg:inline-flex ${
                isDark
                  ? "bg-[#2e2d39] text-[#c7c7d1]"
                  : "bg-[#f5f5f9] text-[#52525b]"
              }`}
            >
              <Folder className="h-3 w-3" />
              <span className="max-w-[72px] truncate">{workspace.folder}</span>
            </button>
          )}

          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draftTitle}
              maxLength={120}
              aria-label="Ubah judul canvas"
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitRename();
                } else if (e.key === "Escape") {
                  setDraftTitle(workspace.title);
                  setEditing(false);
                }
              }}
              className={`w-28 rounded-md border border-[#6965db] px-2 py-0.5 text-xs font-medium outline-none sm:w-32 ${
                isDark ? "bg-[#18181d] text-white" : "bg-white text-[#1b1b1f]"
              }`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Klik untuk ubah nama canvas"
              className={`max-w-[96px] cursor-text truncate rounded-md px-1.5 py-1 text-xs font-medium sm:max-w-[128px] ${btnClass}`}
            >
              {workspace.title}
            </button>
          )}

          {renderStorageStatus()}
        </div>
      )}

      <div
        className={`mx-0.5 h-4 w-px ${isDark ? "bg-[#31303b]" : "bg-[#e5e7eb]"}`}
        aria-hidden="true"
      />

      <button
        type="button"
        disabled={exportingPng}
        onClick={onExportPng}
        title="Export cepat ke PNG"
        aria-label="Export ke PNG"
        className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isDark
            ? "border-[#3a3946] bg-[#2c2b36] text-[#e3e3e8] hover:bg-[#353442]"
            : "border-[#e5e7eb] bg-[#f8f9fa] text-[#1b1b1f] hover:bg-[#f1f0ff]"
        }`}
      >
        {exportingPng ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImageDown className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">PNG</span>
      </button>

      <button
        type="button"
        onClick={onOpenPdf}
        title="Export ke PDF (Cmd+Shift+P)"
        aria-label="Export ke PDF"
        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md bg-[#6965db] px-2.5 text-xs font-medium text-white transition hover:bg-[#5b57d1]"
      >
        <FileDown className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  );
}
