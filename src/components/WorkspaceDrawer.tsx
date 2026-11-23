import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  Cloud,
  Copy,
  Database,
  Download,
  FilePlus2,
  Folder,
  FolderInput,
  FolderPlus,
  HardDrive,
  Layers,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { AuthUser } from "../lib/api";
import { IS_CLOUD_ENABLED } from "../lib/config";
import { db } from "../lib/db";
import * as local from "../services/localWorkspace";
import * as manager from "../services/workspaceManager";
import type {
  StorageFilter,
  StorageMode,
  WorkspaceRecord,
} from "../types/workspace";
import { AppSelect, type SelectOption } from "./AppSelect";

interface WorkspaceDrawerProps {
  open: boolean;
  activeWorkspaceId: string | null;
  user: AuthUser | null;
  onClose: () => void;
  onSelectWorkspace: (id: string) => Promise<void>;
  onCreateCanvas: (opts?: {
    title?: string;
    folder?: string;
    storageMode?: StorageMode;
  }) => Promise<unknown>;
  onRenameWorkspace: (id: string, title: string) => Promise<void>;
  onMoveFolder: (id: string, folder: string) => Promise<void>;
  onDuplicateWorkspace: (id: string) => Promise<void>;
  onDeleteWorkspace: (id: string) => Promise<void>;
  onMoveToDatabase: (id: string) => Promise<void>;
  onMoveToLocal: (id: string, deleteRemote: boolean) => Promise<void>;
  onShareWorkspace: (workspace: WorkspaceRecord) => void;
  onImportFile: (
    file: File,
    folder?: string,
    mode?: StorageMode,
  ) => Promise<void>;
  onSyncCloud: () => Promise<void>;
  onOpenAuth: () => void;
  onNotify: (
    text: string,
    tone?: "info" | "success" | "warning" | "error",
  ) => void;
}

type FolderFilter = "__ALL__" | "__UNFOLDERED__" | string;

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function downloadExcalidrawJson(
  ws: WorkspaceRecord,
  files: Record<string, unknown>,
) {
  const payload = {
    type: "excalidraw",
    version: 2,
    source: "draw-local",
    elements: ws.elements,
    appState: ws.appState,
    files,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ws.title.replace(/[\\/:*?"<>|]/g, "-") || "drawing"}.excalidraw`;
  a.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceDrawer({
  open,
  activeWorkspaceId,
  user,
  onClose,
  onSelectWorkspace,
  onCreateCanvas,
  onRenameWorkspace,
  onMoveFolder,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  onMoveToDatabase,
  onMoveToLocal,
  onShareWorkspace,
  onImportFile,
  onSyncCloud,
  onOpenAuth,
  onNotify,
}: WorkspaceDrawerProps) {
  const workspacesQuery = useLiveQuery(
    () => db.workspaces.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  const workspaces = workspacesQuery ?? [];
  const isLoadingWorkspaces = workspacesQuery === undefined;
  const folders = useLiveQuery(() => local.listFolders(), []) ?? [];

  const [folderFilter, setFolderFilter] = useState<FolderFilter>("__ALL__");
  const [storageFilter, setStorageFilter] = useState<StorageFilter>("all");
  const [search, setSearch] = useState("");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderDraft, setRenameFolderDraft] = useState("");

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState("");
  const [movingFolderCardId, setMovingFolderCardId] = useState<string | null>(
    null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmLocalSwitchId, setConfirmLocalSwitchId] = useState<
    string | null
  >(null);
  const [syncing, setSyncing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const unfolderedCount = useMemo(
    () => workspaces.filter((w) => !w.folder.trim()).length,
    [workspaces],
  );

  const folderOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: "", label: "Tanpa Folder" },
      ...folders.map((fl) => ({ value: fl.name, label: fl.name })),
    ],
    [folders],
  );

  const filteredWorkspaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspaces.filter((ws) => {
      if (storageFilter !== "all" && ws.storageMode !== storageFilter) {
        return false;
      }
      if (folderFilter === "__UNFOLDERED__" && ws.folder.trim() !== "") {
        return false;
      }
      if (
        folderFilter !== "__ALL__" &&
        folderFilter !== "__UNFOLDERED__" &&
        ws.folder !== folderFilter
      ) {
        return false;
      }
      if (q && !ws.title.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [workspaces, storageFilter, folderFilter, search]);

  if (!open) return null;

  const activeFolderForNew =
    folderFilter !== "__ALL__" && folderFilter !== "__UNFOLDERED__"
      ? folderFilter
      : "";

  const createMode: StorageMode =
    IS_CLOUD_ENABLED && storageFilter === "cloud" ? "cloud" : "local";

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await local.createFolder(trimmed);
    setNewFolderName("");
    setNewFolderOpen(false);
    setFolderFilter(trimmed);
    onNotify(`Folder "${trimmed}" dibuat.`, "success");
  };

  const handleCommitRenameFolder = async (oldName: string) => {
    const trimmed = renameFolderDraft.trim();
    setRenamingFolder(null);
    if (!trimmed || trimmed === oldName) return;
    await manager.renameFolderEverywhere(oldName, trimmed);
    if (folderFilter === oldName) {
      setFolderFilter(trimmed);
    }
    onNotify(`Folder diubah menjadi "${trimmed}".`, "info");
  };

  const handleDeleteFolder = async (name: string) => {
    await manager.deleteFolderEverywhere(name);
    if (folderFilter === name) {
      setFolderFilter("__ALL__");
    }
    onNotify(`Folder "${name}" dihapus.`, "info");
  };

  const handleImportChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await onImportFile(file, activeFolderForNew, "local");
      onClose();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Gagal mengimpor file.",
        "error",
      );
    }
  };

  const handleManualSync = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setSyncing(true);
    try {
      await onSyncCloud();
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateNew = async () => {
    if (createMode === "cloud" && !user) {
      onOpenAuth();
      return;
    }
    try {
      await onCreateCanvas({
        folder: activeFolderForNew,
        storageMode: createMode,
      });
      onClose();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Gagal membuat canvas baru.",
        "error",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-canvas-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col border-l border-[#e5e7eb] bg-white text-[#1b1b1f] shadow-2xl dark:border-[#31303b] dark:bg-[#232329] dark:text-[#e3e3e8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header satu baris bersih */}
        <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-5 py-3.5 dark:border-[#31303b]">
          <div className="flex items-center gap-2.5">
            <h2 id="my-canvas-title" className="text-base font-semibold">
              My Canvas
            </h2>
            <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-xs font-medium text-[#6b7280] dark:bg-[#2e2d39] dark:text-[#9b9b9f]">
              {workspaces.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".excalidraw,.json"
              className="hidden"
              onChange={(e) => void handleImportChange(e)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 text-xs font-medium transition hover:bg-[#f5f5f9] dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {IS_CLOUD_ENABLED && (
              <>
                <button
                  type="button"
                  onClick={() => void handleManualSync()}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 text-xs font-medium transition hover:bg-[#f5f5f9] dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
                >
                  {user ? (
                    <>
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                      />
                      <span className="hidden sm:inline">Sync DB</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Database</span>
                    </>
                  )}
                </button>

                {user && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    title={`Akun: ${user.username}`}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-2.5 text-xs font-medium transition hover:bg-[#f5f5f9] dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{user.username}</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => void handleCreateNew()}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-3.5 text-xs font-medium text-white transition hover:bg-[#5b57d1]"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span>
                {createMode === "cloud" ? "New Canvas (DB)" : "New Canvas"}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup My Canvas"
              className="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: Sidebar Folder + Grid Canvas */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex w-full shrink-0 flex-col border-b border-[#e5e7eb] bg-[#f8f9fa] p-3 md:w-60 md:border-r md:border-b-0 dark:border-[#31303b] dark:bg-[#18181d]">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase dark:text-[#9b9b9f]">
                Folder
              </span>
              <button
                type="button"
                aria-label="Buat folder baru"
                onClick={() => setNewFolderOpen((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#6b7280] hover:bg-[#ececf4] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Baru
              </button>
            </div>

            {newFolderOpen && (
              <div className="mb-2 flex gap-1.5">
                <input
                  type="text"
                  autoFocus
                  maxLength={60}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateFolder();
                    if (e.key === "Escape") setNewFolderOpen(false);
                  }}
                  placeholder="Nama folder..."
                  className="w-full rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#6965db] dark:border-[#31303b] dark:bg-[#232329]"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  aria-label="Simpan folder baru"
                  className="cursor-pointer rounded-lg bg-[#6965db] px-2.5 text-white hover:bg-[#5b57d1]"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-y-auto">
              <button
                type="button"
                onClick={() => setFolderFilter("__ALL__")}
                className={`flex shrink-0 cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                  folderFilter === "__ALL__"
                    ? "bg-[#6965db] text-white"
                    : "text-[#374151] hover:bg-[#ececf4] dark:text-[#d4d4dc] dark:hover:bg-[#2e2d39]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5" />
                  Semua Canvas
                </span>
                <span className="text-[11px] opacity-75">
                  {workspaces.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFolderFilter("__UNFOLDERED__")}
                className={`flex shrink-0 cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                  folderFilter === "__UNFOLDERED__"
                    ? "bg-[#6965db] text-white"
                    : "text-[#374151] hover:bg-[#ececf4] dark:text-[#d4d4dc] dark:hover:bg-[#2e2d39]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Folder className="h-3.5 w-3.5 opacity-70" />
                  Tanpa Folder
                </span>
                <span className="text-[11px] opacity-75">
                  {unfolderedCount}
                </span>
              </button>

              {folders.map((f) => (
                <div
                  key={f.name}
                  className={`group flex shrink-0 items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                    folderFilter === f.name
                      ? "bg-[#6965db] text-white"
                      : "text-[#374151] hover:bg-[#ececf4] dark:text-[#d4d4dc] dark:hover:bg-[#2e2d39]"
                  }`}
                >
                  {renamingFolder === f.name ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameFolderDraft}
                      onChange={(e) => setRenameFolderDraft(e.target.value)}
                      onBlur={() => void handleCommitRenameFolder(f.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleCommitRenameFolder(f.name);
                        } else if (e.key === "Escape") {
                          setRenamingFolder(null);
                        }
                      }}
                      className="w-full rounded bg-white px-2 py-0.5 text-xs text-[#1b1b1f] outline-none"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setFolderFilter(f.name)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-1 py-0.5 text-left font-medium"
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>

                      <div className="flex items-center gap-0.5">
                        <span className="px-1 text-[11px] opacity-75">
                          {f.count}
                        </span>
                        <button
                          type="button"
                          title="Ubah nama folder"
                          aria-label={`Ubah nama folder ${f.name}`}
                          onClick={() => {
                            setRenamingFolder(f.name);
                            setRenameFolderDraft(f.name);
                          }}
                          className="cursor-pointer rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="Hapus folder"
                          aria-label={`Hapus folder ${f.name}`}
                          onClick={() => void handleDeleteFolder(f.name)}
                          className="cursor-pointer rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-5 py-3 dark:border-[#31303b]">
              {IS_CLOUD_ENABLED ? (
                <div className="flex items-center gap-1 rounded-lg bg-[#f3f4f6] p-1 dark:bg-[#18181d]">
                  {(
                    [
                      { id: "all", label: "Semua" },
                      { id: "local", label: "Lokal (IndexedDB)" },
                      { id: "cloud", label: "Database" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStorageFilter(tab.id)}
                      className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition ${
                        storageFilter === tab.id
                          ? "bg-white text-[#1b1b1f] shadow-xs dark:bg-[#2e2d39] dark:text-white"
                          : "text-[#6b7280] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-medium text-[#6b7280] dark:bg-[#18181d] dark:text-[#9b9b9f]">
                  <HardDrive className="h-3.5 w-3.5" />
                  <span>Penyimpanan Lokal (IndexedDB)</span>
                </div>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari judul canvas..."
                  className="w-full rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] py-1.5 pr-3 pl-8 text-xs outline-none focus:border-[#6965db] focus:bg-white dark:border-[#31303b] dark:bg-[#18181d] dark:focus:bg-[#121212]"
                />
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoadingWorkspaces ? (
                <div className="flex h-60 items-center justify-center text-xs text-[#6b7280] dark:text-[#9b9b9f]">
                  Memuat daftar canvas...
                </div>
              ) : filteredWorkspaces.length === 0 ? (
                <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed border-[#d1d5db] p-6 text-center dark:border-[#31303b]">
                  <p className="text-sm font-medium">
                    Belum ada canvas di tampilan ini
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCreateNew()}
                    className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-4 py-2 text-xs font-medium text-white hover:bg-[#5b57d1]"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Buat Canvas Baru
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredWorkspaces.map((ws) => {
                    const isActive = ws.id === activeWorkspaceId;
                    const isCloud =
                      IS_CLOUD_ENABLED && ws.storageMode === "cloud";

                    return (
                      <div
                        key={ws.id}
                        className={`flex flex-col overflow-hidden rounded-xl border transition ${
                          isActive
                            ? "border-[#6965db] ring-1 ring-[#6965db]/40"
                            : "border-[#e5e7eb] hover:border-[#6965db]/60 dark:border-[#31303b] dark:hover:border-[#6965db]/60"
                        } bg-white dark:bg-[#1c1c21]`}
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            await onSelectWorkspace(ws.id);
                            onClose();
                          }}
                          className="relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden border-b border-[#e5e7eb] bg-[#f8f9fa] p-3 dark:border-[#31303b] dark:bg-[#141418]"
                        >
                          {ws.thumbnail ? (
                            <img
                              src={ws.thumbnail}
                              alt={`Pratinjau ${ws.title}`}
                              className="max-h-full max-w-full rounded object-contain"
                            />
                          ) : (
                            <span className="text-[11px] text-[#9ca3af] dark:text-[#6b6b76]">
                              Kanvas Kosong
                            </span>
                          )}

                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                            {isActive && (
                              <span className="rounded bg-[#6965db] px-1.5 py-0.5 text-[10px] font-medium text-white">
                                Aktif
                              </span>
                            )}
                            {ws.folder && (
                              <span className="inline-flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#374151] dark:bg-[#232329]/90 dark:text-[#d4d4dc]">
                                <Folder className="h-2.5 w-2.5" />
                                {ws.folder}
                              </span>
                            )}
                          </div>

                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                            {IS_CLOUD_ENABLED &&
                              ws.shareEnabled &&
                              ws.shareToken && (
                                <span
                                  title={
                                    ws.sharePermission === "contributor"
                                      ? "Link aktif: Contributor (Read & Write)"
                                      : "Link aktif: Read Only"
                                  }
                                  className="inline-flex items-center gap-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white"
                                >
                                  <Share2 className="h-2.5 w-2.5" />
                                  {ws.sharePermission === "contributor"
                                    ? "Contributor"
                                    : "Read Only"}
                                </span>
                              )}
                            <span className="inline-flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[#52525b] dark:bg-[#232329]/90 dark:text-[#b4b4c0]">
                              {isCloud ? (
                                <>
                                  <Cloud className="h-2.5 w-2.5" />
                                  DB
                                </>
                              ) : (
                                <>
                                  <HardDrive className="h-2.5 w-2.5" />
                                  Lokal
                                </>
                              )}
                            </span>
                          </div>
                        </button>

                        <div className="flex flex-1 flex-col justify-between p-3.5">
                          <div>
                            {editingCardId === ws.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={editingCardTitle}
                                onChange={(e) =>
                                  setEditingCardTitle(e.target.value)
                                }
                                onBlur={async () => {
                                  const next = editingCardTitle.trim();
                                  setEditingCardId(null);
                                  if (next && next !== ws.title) {
                                    await onRenameWorkspace(ws.id, next);
                                  }
                                }}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter") {
                                    const next = editingCardTitle.trim();
                                    setEditingCardId(null);
                                    if (next && next !== ws.title) {
                                      await onRenameWorkspace(ws.id, next);
                                    }
                                  } else if (e.key === "Escape") {
                                    setEditingCardId(null);
                                  }
                                }}
                                className="w-full rounded-md border border-[#6965db] bg-white px-2 py-1 text-xs font-medium text-[#1b1b1f] outline-none dark:bg-[#121212] dark:text-white"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onSelectWorkspace(ws.id);
                                  onClose();
                                }}
                                className="line-clamp-1 w-full cursor-pointer text-left text-xs font-semibold hover:text-[#6965db]"
                              >
                                {ws.title}
                              </button>
                            )}

                            <div className="mt-1 flex items-center justify-between text-[11px] text-[#6b7280] dark:text-[#9b9b9f]">
                              <span>{ws.elementCount} elemen</span>
                              <span>{formatRelativeTime(ws.updatedAt)}</span>
                            </div>
                          </div>

                          {movingFolderCardId === ws.id && (
                            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-[#f3f4f6] p-1.5 dark:bg-[#141418]">
                              <AppSelect<string>
                                ariaLabel="Pilih folder tujuan"
                                value={ws.folder}
                                options={folderOptions}
                                isSearchable={folders.length > 5}
                                compact
                                className="flex-1"
                                onChange={async (nextFolder) => {
                                  await onMoveFolder(ws.id, nextFolder);
                                  setMovingFolderCardId(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setMovingFolderCardId(null)}
                                aria-label="Tutup pemilih folder"
                                className="cursor-pointer rounded p-1 text-[#6b7280] hover:bg-black/5 dark:hover:bg-white/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          {IS_CLOUD_ENABLED &&
                            confirmLocalSwitchId === ws.id && (
                              <div className="mt-2.5 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-2 text-[11px] dark:border-[#31303b] dark:bg-[#141418]">
                                <p className="mb-1.5 font-medium">
                                  Putuskan dari Database?
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setConfirmLocalSwitchId(null);
                                      await onMoveToLocal(ws.id, true);
                                    }}
                                    className="cursor-pointer rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700"
                                  >
                                    Hapus dari DB
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setConfirmLocalSwitchId(null);
                                      await onMoveToLocal(ws.id, false);
                                    }}
                                    className="cursor-pointer rounded border border-[#d1d5db] bg-white px-2 py-1 font-medium dark:border-[#3e3d4a] dark:bg-[#232329]"
                                  >
                                    Simpan Lokal Saja
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmLocalSwitchId(null)
                                    }
                                    className="cursor-pointer rounded px-2 py-1 text-[#6b7280]"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}

                          <div className="mt-3 flex items-center justify-between border-t border-[#f3f4f6] pt-2.5 dark:border-[#2a2a33]">
                            <div className="flex items-center gap-0.5 text-[#6b7280] dark:text-[#9b9b9f]">
                              <button
                                type="button"
                                title="Ubah judul"
                                aria-label="Ubah judul"
                                onClick={() => {
                                  setEditingCardId(ws.id);
                                  setEditingCardTitle(ws.title);
                                }}
                                className="cursor-pointer rounded-md p-1.5 hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Pindah folder"
                                aria-label="Pindah folder"
                                onClick={() =>
                                  setMovingFolderCardId((cur) =>
                                    cur === ws.id ? null : ws.id,
                                  )
                                }
                                className="cursor-pointer rounded-md p-1.5 hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
                              >
                                <FolderInput className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Duplikasi canvas"
                                aria-label="Duplikasi canvas"
                                onClick={() => void onDuplicateWorkspace(ws.id)}
                                className="cursor-pointer rounded-md p-1.5 hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                title="Unduh .excalidraw"
                                aria-label="Unduh file excalidraw"
                                onClick={async () => {
                                  const files = await local.getWorkspaceFiles(
                                    ws.id,
                                  );
                                  downloadExcalidrawJson(ws, files);
                                }}
                                className="cursor-pointer rounded-md p-1.5 hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>

                              {IS_CLOUD_ENABLED && (
                                <button
                                  type="button"
                                  title="Bagikan link preview"
                                  aria-label="Bagikan link preview"
                                  onClick={() => onShareWorkspace(ws)}
                                  className={`cursor-pointer rounded-md p-1.5 hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:hover:bg-[#2e2d39] dark:hover:text-white ${
                                    ws.shareEnabled && ws.shareToken
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : ""
                                  }`}
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {IS_CLOUD_ENABLED &&
                                (isCloud ? (
                                  <button
                                    type="button"
                                    title="Pindah ke Lokal"
                                    onClick={() =>
                                      setConfirmLocalSwitchId((cur) =>
                                        cur === ws.id ? null : ws.id,
                                      )
                                    }
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#e5e7eb] px-2 py-1 text-[11px] font-medium hover:bg-[#f3f4f6] dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
                                  >
                                    <HardDrive className="h-3 w-3" />
                                    Ke Lokal
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="Simpan ke Database"
                                    onClick={async () => {
                                      if (!user) {
                                        onOpenAuth();
                                        return;
                                      }
                                      try {
                                        await onMoveToDatabase(ws.id);
                                      } catch (err) {
                                        onNotify(
                                          err instanceof Error
                                            ? err.message
                                            : "Gagal menyimpan ke Database.",
                                          "error",
                                        );
                                      }
                                    }}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#e5e7eb] px-2 py-1 text-[11px] font-medium hover:border-[#6965db] hover:text-[#6965db] dark:border-[#31303b] dark:hover:border-[#6965db]"
                                  >
                                    <Database className="h-3 w-3" />
                                    Simpan DB
                                  </button>
                                ))}

                              {confirmDeleteId === ws.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setConfirmDeleteId(null);
                                    await onDeleteWorkspace(ws.id);
                                  }}
                                  className="cursor-pointer rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                                >
                                  Hapus?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Hapus canvas"
                                  aria-label="Hapus canvas"
                                  onClick={() => setConfirmDeleteId(ws.id)}
                                  className="cursor-pointer rounded-md p-1.5 text-[#6b7280] hover:bg-red-500/10 hover:text-red-600 dark:text-[#9b9b9f] dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
