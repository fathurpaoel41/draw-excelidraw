import { getSceneVersion } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../lib/api";
import { generateWorkspaceThumbnail } from "../lib/thumbnail";
import * as cloud from "../services/cloudWorkspace";
import * as local from "../services/localWorkspace";
import * as manager from "../services/workspaceManager";
import type {
  AppState,
  BinaryFiles,
  CloudWorkspaceDetail,
  ExcalidrawImperativeAPI,
  OrderedExcalidrawElement,
  SharePermission,
  SharedWorkspaceDetail,
  StorageMode,
  SyncStatus,
  WorkspaceWithFiles,
} from "../types/workspace";

export interface ConflictState {
  localWorkspace: WorkspaceWithFiles;
  serverWorkspace: CloudWorkspaceDetail;
}

export interface SharedSessionInfo {
  token: string;
  permission: SharePermission;
  ownerUsername: string;
}

function getShareTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const val = new URLSearchParams(window.location.search).get("share");
  const trimmed = val?.trim() ?? "";
  return trimmed || null;
}

function clearShareTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("share")) {
    url.searchParams.delete("share");
    window.history.replaceState({}, "", url.toString());
  }
}

function sharedDetailToWorkspace(
  detail: SharedWorkspaceDetail,
): WorkspaceWithFiles {
  const appState = local.extractPersistedAppState(detail.app_state);
  const elements = detail.elements ?? [];
  return {
    id: detail.id,
    title: detail.judul,
    folder: "",
    storageMode: "cloud",
    remoteId: detail.id,
    elements,
    appState,
    thumbnail: detail.thumbnail,
    elementCount: elements.filter((el) => !el.isDeleted).length,
    version: detail.versi,
    syncStatus: "synced",
    shareEnabled: true,
    sharePermission: detail.share_permission,
    shareToken: null,
    createdAt: detail.dibuat,
    updatedAt: detail.diperbarui,
    files: (detail.files ?? {}) as BinaryFiles,
  };
}

function sharedDetailToConflictServer(
  detail: SharedWorkspaceDetail,
): CloudWorkspaceDetail {
  return {
    id: detail.id,
    user_id: detail.user_id,
    judul: detail.judul,
    folder: "",
    elements: detail.elements,
    app_state: detail.app_state,
    thumbnail: detail.thumbnail,
    versi: detail.versi,
    share_enabled: true,
    share_permission: detail.share_permission,
    share_token: null,
    dibuat: detail.dibuat,
    diperbarui: detail.diperbarui,
    files: detail.files,
  };
}

function buildSceneSignature(
  elements: readonly OrderedExcalidrawElement[],
  appState: Pick<
    AppState,
    "viewBackgroundColor" | "theme" | "gridSize" | "gridModeEnabled"
  >,
  files: BinaryFiles,
): string {
  const version = getSceneVersion(elements);
  const fileCount = Object.keys(files).length;
  return `${version}|${appState.viewBackgroundColor}|${appState.theme}|${appState.gridSize}|${String(appState.gridModeEnabled)}|${fileCount}`;
}

function sameWorkspaceHeader(
  a: WorkspaceWithFiles | null,
  b: WorkspaceWithFiles,
): boolean {
  if (!a) return false;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.folder === b.folder &&
    a.storageMode === b.storageMode &&
    a.remoteId === b.remoteId &&
    a.version === b.version &&
    a.syncStatus === b.syncStatus
  );
}

export function useWorkspace(params: {
  isAuthenticated: boolean;
  onNotify: (
    text: string,
    tone?: "info" | "success" | "warning" | "error",
  ) => void;
}) {
  const { isAuthenticated, onNotify } = params;

  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceWithFiles | null>(null);
  const [sessionSnapshot, setSessionSnapshot] =
    useState<WorkspaceWithFiles | null>(null);
  const [sessionKey, setSessionKey] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local_only");
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [sharedSession, setSharedSession] = useState<SharedSessionInfo | null>(
    null,
  );
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [isLoadingShared, setIsLoadingShared] = useState<boolean>(() =>
    Boolean(getShareTokenFromUrl()),
  );

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const activeWorkspaceRef = useRef<WorkspaceWithFiles | null>(null);
  const sharedSessionRef = useRef<SharedSessionInfo | null>(null);
  const syncStatusRef = useRef<SyncStatus>("local_only");
  const lastSavedSigRef = useRef<string>("");
  const lastThumbSigRef = useRef<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackIdRef = useRef<number | null>(null);
  const latestSceneRef = useRef<{
    elements: readonly OrderedExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  } | null>(null);
  const isSavingRef = useRef<boolean>(false);

  activeWorkspaceRef.current = activeWorkspace;
  sharedSessionRef.current = sharedSession;

  const updateSyncStatus = useCallback((next: SyncStatus) => {
    if (syncStatusRef.current !== next) {
      syncStatusRef.current = next;
      setSyncStatus(next);
    }
  }, []);

  const clearScheduledThumbnail = useCallback(() => {
    if (thumbTimerRef.current) {
      clearTimeout(thumbTimerRef.current);
      thumbTimerRef.current = null;
    }
    if (
      idleCallbackIdRef.current !== null &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleCallbackIdRef.current);
      idleCallbackIdRef.current = null;
    }
  }, []);

  const setExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  const mountWorkspaceSession = useCallback(
    (ws: WorkspaceWithFiles) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      clearScheduledThumbnail();
      latestSceneRef.current = null;

      const sig = buildSceneSignature(
        ws.elements,
        {
          viewBackgroundColor: ws.appState.viewBackgroundColor,
          theme: ws.appState.theme,
          gridSize: ws.appState.gridSize,
          gridModeEnabled: Boolean(ws.appState.gridModeEnabled),
        },
        ws.files,
      );
      lastSavedSigRef.current = sig;
      lastThumbSigRef.current = sig;

      setActiveWorkspace(ws);
      setSessionSnapshot(ws);
      updateSyncStatus(ws.syncStatus);
      setSessionKey((prev) => prev + 1);
    },
    [clearScheduledThumbnail, updateSyncStatus],
  );

  const loadSharedByToken = useCallback(
    async (token: string) => {
      setIsLoadingShared(true);
      setSharedError(null);
      try {
        const detail = await cloud.getSharedWorkspace(token);
        const sessionInfo: SharedSessionInfo = {
          token,
          permission: detail.share_permission,
          ownerUsername: detail.owner_username,
        };
        sharedSessionRef.current = sessionInfo;
        setSharedSession(sessionInfo);
        mountWorkspaceSession(sharedDetailToWorkspace(detail));
      } catch (err) {
        sharedSessionRef.current = null;
        setSharedSession(null);
        setSharedError(
          err instanceof Error
            ? err.message
            : "Link bagikan tidak ditemukan atau sudah dinonaktifkan.",
        );
      } finally {
        setIsLoadingShared(false);
      }
    },
    [mountWorkspaceSession],
  );

  // Load workspace dari share link jika ada ?share=<token>, atau workspace terakhir dari IndexedDB
  useEffect(() => {
    let mounted = true;
    const shareToken = getShareTokenFromUrl();
    if (shareToken) {
      void loadSharedByToken(shareToken);
    } else {
      manager
        .ensureInitialWorkspace()
        .then((ws) => {
          if (!mounted) return;
          mountWorkspaceSession(ws);
        })
        .catch(() => {
          if (!mounted) return;
          onNotify("Gagal memuat workspace lokal dari browser.", "error");
        });
    }

    const onPopState = () => {
      const token = getShareTokenFromUrl();
      if (token) {
        void loadSharedByToken(token);
      } else if (sharedSessionRef.current) {
        sharedSessionRef.current = null;
        setSharedSession(null);
        setSharedError(null);
        setIsLoadingShared(false);
        void manager.ensureInitialWorkspace().then((ws) => {
          if (mounted) mountWorkspaceSession(ws);
        });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      mounted = false;
      window.removeEventListener("popstate", onPopState);
    };
  }, [loadSharedByToken, mountWorkspaceSession, onNotify]);

  // Sinkronisasi daftar workspace Cloud ke cache IndexedDB bila login & online
  const syncAllFromCloud = useCallback(
    async (silent = false) => {
      if (!isAuthenticated || !navigator.onLine) return;
      try {
        const count = await manager.syncCloudToLocalCache();
        if (!silent) {
          onNotify(
            count > 0
              ? `Sinkronisasi selesai (${count} canvas diperbarui).`
              : "Semua canvas Database sudah sinkron.",
            "success",
          );
        }
      } catch {
        if (!silent) {
          onNotify("Gagal menyinkronkan dengan Database.", "warning");
        }
      }
    },
    [isAuthenticated, onNotify],
  );

  useEffect(() => {
    if (isAuthenticated) {
      void syncAllFromCloud(true);
    }
  }, [isAuthenticated, syncAllFromCloud]);

  // Monitor status online/offline & flush pending cloud save saat kembali online
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void syncAllFromCloud(true);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncAllFromCloud]);

  const refreshActiveThumbnail = useCallback(async () => {
    if (sharedSessionRef.current) return;
    const current = activeWorkspaceRef.current;
    const api = apiRef.current;
    if (!current || !api) return;

    const elements = api.getSceneElementsIncludingDeleted();
    const appState = api.getAppState();
    const files = api.getFiles();
    const sig = buildSceneSignature(elements, appState, files);
    if (sig === lastThumbSigRef.current) return;

    const thumbnail = await generateWorkspaceThumbnail(
      elements,
      {
        viewBackgroundColor: appState.viewBackgroundColor,
        theme: appState.theme,
      },
      files,
    );

    await local.saveLocalWorkspace(current.id, {
      thumbnail,
      updatedAt: current.updatedAt,
    });
    lastThumbSigRef.current = sig;
  }, []);

  const scheduleIdleThumbnail = useCallback(() => {
    clearScheduledThumbnail();
    thumbTimerRef.current = setTimeout(() => {
      thumbTimerRef.current = null;
      if (typeof window.requestIdleCallback === "function") {
        idleCallbackIdRef.current = window.requestIdleCallback(
          () => {
            idleCallbackIdRef.current = null;
            void refreshActiveThumbnail();
          },
          { timeout: 3000 },
        );
      } else {
        void refreshActiveThumbnail();
      }
    }, 5000);
  }, [clearScheduledThumbnail, refreshActiveThumbnail]);

  const performSave = useCallback(
    async (
      options: {
        force?: boolean;
        syncCloud?: boolean;
        withThumbnail?: boolean;
      } = {},
    ): Promise<void> => {
      const current = activeWorkspaceRef.current;
      const api = apiRef.current;
      if (!current || !api) return;
      if (isSavingRef.current && !options.force) return;

      const snapshot = latestSceneRef.current;
      const elements =
        options.force || !snapshot
          ? api.getSceneElementsIncludingDeleted()
          : snapshot.elements;
      const appState =
        options.force || !snapshot ? api.getAppState() : snapshot.appState;
      const files =
        options.force || !snapshot ? api.getFiles() : snapshot.files;

      const sig = buildSceneSignature(elements, appState, files);
      if (!options.force && sig === lastSavedSigRef.current) {
        return;
      }

      const activeShare = sharedSessionRef.current;
      if (activeShare) {
        if (activeShare.permission !== "contributor") {
          return;
        }
        isSavingRef.current = true;
        updateSyncStatus("saving");
        try {
          const thumbnail =
            options.withThumbnail === true
              ? await generateWorkspaceThumbnail(
                  elements,
                  {
                    viewBackgroundColor: appState.viewBackgroundColor,
                    theme: appState.theme,
                  },
                  files,
                )
              : current.thumbnail;
          const persistedAppState = local.extractPersistedAppState(appState);
          const referencedFiles = local.filterReferencedFiles(elements, files);
          const remote = await cloud.updateSharedWorkspace(activeShare.token, {
            judul: current.title,
            elements,
            app_state: persistedAppState,
            thumbnail,
            expected_version: current.version,
            files: referencedFiles,
          });
          lastSavedSigRef.current = sig;
          const nextWorkspace = sharedDetailToWorkspace(remote);
          activeWorkspaceRef.current = nextWorkspace;
          setActiveWorkspace(nextWorkspace);
          updateSyncStatus("synced");
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            const conflictData = err.data as
              { current?: SharedWorkspaceDetail } | undefined;
            if (conflictData?.current) {
              updateSyncStatus("conflict");
              setConflict({
                localWorkspace: {
                  ...current,
                  elements: [...elements],
                  appState: local.extractPersistedAppState(appState),
                  files,
                },
                serverWorkspace: sharedDetailToConflictServer(
                  conflictData.current,
                ),
              });
              onNotify(
                "Konflik versi: kanvas telah diubah oleh pengguna lain.",
                "warning",
              );
              return;
            }
          }
          if (err instanceof ApiError && err.status === 403) {
            setSharedSession((prev) =>
              prev ? { ...prev, permission: "readonly" } : prev,
            );
            updateSyncStatus("synced");
            onNotify("Izin link diubah pemilik menjadi Read Only.", "warning");
            return;
          }
          updateSyncStatus("error");
        } finally {
          isSavingRef.current = false;
        }
        return;
      }

      isSavingRef.current = true;
      updateSyncStatus("saving");

      try {
        const shouldRenderThumbnail = options.withThumbnail === true;
        const thumbnail = shouldRenderThumbnail
          ? await generateWorkspaceThumbnail(
              elements,
              {
                viewBackgroundColor: appState.viewBackgroundColor,
                theme: appState.theme,
              },
              files,
            )
          : current.thumbnail;

        const outcome = await manager.saveWorkspace(
          current.id,
          {
            elements,
            appState,
            files,
            thumbnail,
          },
          { syncCloud: options.syncCloud ?? true },
        );

        lastSavedSigRef.current = sig;
        if (shouldRenderThumbnail) {
          lastThumbSigRef.current = sig;
        } else {
          scheduleIdleThumbnail();
        }

        if (outcome.status === "conflict") {
          setActiveWorkspace(outcome.workspace);
          updateSyncStatus("conflict");
          setConflict({
            localWorkspace: outcome.workspace,
            serverWorkspace: outcome.serverWorkspace,
          });
          onNotify(
            "Konflik versi terdeteksi pada Database. Pilih versi yang ingin dipakai.",
            "warning",
          );
          return;
        }

        activeWorkspaceRef.current = outcome.workspace;
        if (!sameWorkspaceHeader(current, outcome.workspace)) {
          setActiveWorkspace(outcome.workspace);
        }
        updateSyncStatus(outcome.workspace.syncStatus);
      } catch {
        updateSyncStatus("error");
      } finally {
        isSavingRef.current = false;
      }
    },
    [onNotify, scheduleIdleThumbnail, updateSyncStatus],
  );

  // Flush simpan segera saat tab ditutup / disembunyikan
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void performSave({
          syncCloud: Boolean(sharedSessionRef.current),
          withThumbnail: false,
        });
      }
    };
    const handlePageHide = () => {
      void performSave({
        syncCloud: Boolean(sharedSessionRef.current),
        withThumbnail: false,
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [performSave]);

  // Hot-path scroll/pointer: coalescing timer (1 pointer assignment + 1 null check per frame)
  const handleSceneChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const current = activeWorkspaceRef.current;
      if (!current) return;
      if (sharedSessionRef.current?.permission === "readonly") return;

      latestSceneRef.current = { elements, appState, files };

      if (debounceTimerRef.current !== null) {
        return;
      }

      clearScheduledThumbnail();

      const delay = current.storageMode === "cloud" ? 1600 : 900;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void performSave({ withThumbnail: false });
      }, delay);
    },
    [clearScheduledThumbnail, performSave],
  );

  const forceSave = useCallback(async () => {
    if (sharedSessionRef.current?.permission === "readonly") {
      onNotify(
        "Mode Read Only: Anda tidak memiliki izin untuk menyimpan perubahan.",
        "warning",
      );
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await performSave({ force: true, syncCloud: true, withThumbnail: true });
    onNotify("Canvas tersimpan.", "success");
  }, [onNotify, performSave]);

  const prepareDrawerOpen = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      await performSave({ withThumbnail: true });
    } else {
      await refreshActiveThumbnail();
    }
  }, [performSave, refreshActiveThumbnail]);

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (activeWorkspaceRef.current?.id === id) return;
      await performSave({ syncCloud: true, withThumbnail: true });
      const target = await manager.openWorkspace(id);
      if (!target) {
        onNotify("Canvas tidak ditemukan.", "error");
        return;
      }
      mountWorkspaceSession(target);
    },
    [mountWorkspaceSession, onNotify, performSave],
  );

  const createNewCanvas = useCallback(
    async (opts?: {
      title?: string;
      folder?: string;
      storageMode?: StorageMode;
    }) => {
      await performSave({ syncCloud: true, withThumbnail: true });
      const current = activeWorkspaceRef.current;
      const created = await manager.createNewWorkspace({
        title: opts?.title || "Untitled Canvas",
        folder: opts?.folder ?? current?.folder ?? "",
        storageMode: opts?.storageMode ?? "local",
        appState: {
          theme: current?.appState.theme ?? "light",
          viewBackgroundColor:
            current?.appState.theme === "dark" ? "#121212" : "#ffffff",
        },
      });
      mountWorkspaceSession(created);
      onNotify(
        created.storageMode === "cloud"
          ? `Canvas baru "${created.title}" dibuat di Database.`
          : `Canvas baru "${created.title}" dibuat di Lokal.`,
        "success",
      );
      return created;
    },
    [mountWorkspaceSession, onNotify, performSave],
  );

  const renameActiveWorkspace = useCallback(
    async (newTitle: string) => {
      const current = activeWorkspaceRef.current;
      const cleaned = newTitle.trim().slice(0, 120);
      if (!current || !cleaned || cleaned === current.title) return;

      const activeShare = sharedSessionRef.current;
      if (activeShare) {
        if (activeShare.permission !== "contributor") return;
        const api = apiRef.current;
        const elements = api
          ? api.getSceneElementsIncludingDeleted()
          : current.elements;
        const appState = api ? api.getAppState() : current.appState;
        const files = api ? api.getFiles() : current.files;
        try {
          const remote = await cloud.updateSharedWorkspace(activeShare.token, {
            judul: cleaned,
            elements,
            app_state: local.extractPersistedAppState(appState),
            expected_version: current.version,
            files: local.filterReferencedFiles(elements, files),
          });
          const nextWorkspace = sharedDetailToWorkspace(remote);
          activeWorkspaceRef.current = nextWorkspace;
          setActiveWorkspace(nextWorkspace);
          updateSyncStatus("synced");
        } catch (err) {
          onNotify(
            err instanceof Error ? err.message : "Gagal mengubah judul canvas.",
            "error",
          );
        }
        return;
      }

      const updated = await manager.updateWorkspaceMeta(current.id, {
        title: cleaned,
      });
      if (updated) {
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
      }
    },
    [onNotify, updateSyncStatus],
  );

  const moveWorkspaceFolder = useCallback(
    async (id: string, folder: string) => {
      const updated = await manager.updateWorkspaceMeta(id, { folder });
      if (updated && activeWorkspaceRef.current?.id === id) {
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
      }
      onNotify(
        folder
          ? `Dipindahkan ke folder "${folder}".`
          : "Dipindahkan ke Tanpa Folder.",
        "info",
      );
    },
    [onNotify, updateSyncStatus],
  );

  const renameAnyWorkspace = useCallback(
    async (id: string, title: string) => {
      const cleaned = title.trim().slice(0, 120);
      if (!cleaned) return;
      const updated = await manager.updateWorkspaceMeta(id, { title: cleaned });
      if (updated && activeWorkspaceRef.current?.id === id) {
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
      }
    },
    [updateSyncStatus],
  );

  const moveToDatabase = useCallback(
    async (id: string) => {
      if (activeWorkspaceRef.current?.id === id) {
        await performSave({
          force: true,
          syncCloud: false,
          withThumbnail: true,
        });
      }
      const updated = await manager.moveWorkspaceToDatabase(id);
      if (activeWorkspaceRef.current?.id === id) {
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
      }
      onNotify(`"${updated.title}" sekarang tersimpan di Database.`, "success");
    },
    [onNotify, performSave, updateSyncStatus],
  );

  const moveToLocal = useCallback(
    async (id: string, deleteRemote: boolean) => {
      if (activeWorkspaceRef.current?.id === id) {
        await performSave({
          force: true,
          syncCloud: false,
          withThumbnail: true,
        });
      }
      const updated = await manager.moveWorkspaceToLocal(id, deleteRemote);
      if (activeWorkspaceRef.current?.id === id) {
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
      }
      onNotify(
        deleteRemote
          ? `"${updated.title}" dipindahkan ke Lokal (salinan Database dihapus).`
          : `"${updated.title}" sekarang disimpan sebagai Lokal saja.`,
        "info",
      );
    },
    [onNotify, performSave, updateSyncStatus],
  );

  const duplicateAnyWorkspace = useCallback(
    async (id: string) => {
      if (activeWorkspaceRef.current?.id === id) {
        await performSave({
          force: true,
          syncCloud: true,
          withThumbnail: true,
        });
      }
      const dup = await manager.duplicateWorkspace(id);
      if (dup) {
        mountWorkspaceSession(dup);
        onNotify(`Duplikasi "${dup.title}" berhasil dibuat.`, "success");
      }
    },
    [mountWorkspaceSession, onNotify, performSave],
  );

  const deleteAnyWorkspace = useCallback(
    async (id: string) => {
      const wasActive = activeWorkspaceRef.current?.id === id;
      await manager.deleteWorkspace(id);
      if (wasActive) {
        const fallback = await manager.ensureInitialWorkspace();
        mountWorkspaceSession(fallback);
      }
      onNotify("Canvas dihapus.", "info");
    },
    [mountWorkspaceSession, onNotify],
  );

  const importExcalidrawFile = useCallback(
    async (
      file: File,
      targetFolder = "",
      targetMode: StorageMode = "local",
    ) => {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        elements?: OrderedExcalidrawElement[];
        appState?: Record<string, unknown>;
        files?: BinaryFiles;
      };
      if (!Array.isArray(parsed.elements)) {
        throw new Error("Format file .excalidraw tidak valid.");
      }
      await performSave({ syncCloud: true, withThumbnail: true });
      const title =
        file.name.replace(/\.excalidraw(\.json)?$/i, "") || "Import Canvas";
      const created = await manager.createNewWorkspace({
        title,
        folder: targetFolder,
        storageMode: targetMode,
        elements: parsed.elements,
        appState: local.extractPersistedAppState(parsed.appState),
        files: parsed.files ?? {},
      });
      mountWorkspaceSession(created);
      onNotify(`File "${title}" berhasil diimpor ke My Canvas.`, "success");
    },
    [mountWorkspaceSession, onNotify, performSave],
  );

  const resolveConflict = useCallback(
    async (strategy: "server" | "overwrite" | "copy") => {
      if (!conflict) return;
      const { localWorkspace, serverWorkspace } = conflict;

      const activeShare = sharedSessionRef.current;
      if (activeShare) {
        if (strategy === "server") {
          const updated: WorkspaceWithFiles = {
            ...localWorkspace,
            title: serverWorkspace.judul,
            elements: serverWorkspace.elements,
            appState: local.extractPersistedAppState(serverWorkspace.app_state),
            files: serverWorkspace.files as BinaryFiles,
            thumbnail: serverWorkspace.thumbnail,
            version: serverWorkspace.versi,
            syncStatus: "synced",
            updatedAt: serverWorkspace.diperbarui,
          };
          mountWorkspaceSession(updated);
          setConflict(null);
          onNotify("Versi terbaru dari server berhasil dimuat.", "success");
        } else if (strategy === "overwrite") {
          const remote = await cloud.updateSharedWorkspace(activeShare.token, {
            judul: localWorkspace.title,
            elements: localWorkspace.elements,
            app_state: localWorkspace.appState,
            thumbnail: localWorkspace.thumbnail,
            expected_version: serverWorkspace.versi,
            files: local.filterReferencedFiles(
              localWorkspace.elements,
              localWorkspace.files,
            ),
          });
          const updated = sharedDetailToWorkspace(remote);
          activeWorkspaceRef.current = updated;
          setActiveWorkspace(updated);
          updateSyncStatus("synced");
          setConflict(null);
          onNotify("Perubahan Anda berhasil menimpa versi server.", "success");
        } else {
          const localCopy = await local.createLocalWorkspace({
            title: `${localWorkspace.title} (Salinan Lokal)`.slice(0, 120),
            folder: "",
            storageMode: "local",
            elements: localWorkspace.elements,
            appState: localWorkspace.appState,
            files: localWorkspace.files,
            thumbnail: localWorkspace.thumbnail,
          });
          clearShareTokenFromUrl();
          sharedSessionRef.current = null;
          setSharedSession(null);
          setSharedError(null);
          mountWorkspaceSession(localCopy);
          setConflict(null);
          onNotify(
            `Versi Anda disimpan ke My Canvas sebagai "${localCopy.title}".`,
            "info",
          );
        }
        return;
      }

      if (strategy === "server") {
        const updated = await manager.resolveConflictWithServer(
          localWorkspace.id,
          serverWorkspace,
        );
        mountWorkspaceSession(updated);
        setConflict(null);
        onNotify("Versi Database berhasil dimuat.", "success");
      } else if (strategy === "overwrite") {
        const updated = await manager.resolveConflictOverwriteServer(
          localWorkspace.id,
          serverWorkspace.versi,
        );
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
        setConflict(null);
        onNotify("Versi Lokal berhasil menimpa versi Database.", "success");
      } else {
        const { localCopy } = await manager.resolveConflictSaveAsLocalCopy(
          localWorkspace.id,
          serverWorkspace,
        );
        mountWorkspaceSession(localCopy);
        setConflict(null);
        onNotify(`Versi Anda disimpan sebagai "${localCopy.title}".`, "info");
      }
    },
    [conflict, mountWorkspaceSession, onNotify, updateSyncStatus],
  );

  const initialData = useMemo(() => {
    if (!sessionSnapshot) return null;
    return {
      elements: sessionSnapshot.elements,
      appState: {
        viewBackgroundColor: sessionSnapshot.appState.viewBackgroundColor,
        theme: sessionSnapshot.appState.theme,
        gridSize: sessionSnapshot.appState.gridSize,
        gridModeEnabled: Boolean(sessionSnapshot.appState.gridModeEnabled),
        scrollX: sessionSnapshot.appState.scrollX,
        scrollY: sessionSnapshot.appState.scrollY,
        zoom: sessionSnapshot.appState.zoom,
        currentItemFontFamily: sessionSnapshot.appState.currentItemFontFamily,
        currentItemStrokeColor: sessionSnapshot.appState.currentItemStrokeColor,
        currentItemBackgroundColor:
          sessionSnapshot.appState.currentItemBackgroundColor,
        currentItemRoughness: sessionSnapshot.appState.currentItemRoughness,
        currentItemStrokeWidth: sessionSnapshot.appState.currentItemStrokeWidth,
        name: sessionSnapshot.title,
      },
      files: sessionSnapshot.files,
      scrollToContent: false,
    };
  }, [sessionSnapshot]);

  const configureShare = useCallback(
    async (
      id: string,
      config: {
        enabled: boolean;
        permission?: SharePermission;
        regenerate?: boolean;
      },
    ) => {
      if (activeWorkspaceRef.current?.id === id && config.enabled) {
        await performSave({
          force: true,
          syncCloud: false,
          withThumbnail: true,
        });
      }
      const updated = await manager.configureWorkspaceShare(id, config);
      if (activeWorkspaceRef.current?.id === id) {
        activeWorkspaceRef.current = updated;
        setActiveWorkspace(updated);
        updateSyncStatus(updated.syncStatus);
      }
      return updated;
    },
    [performSave, updateSyncStatus],
  );

  const refreshSharedWorkspace = useCallback(async () => {
    const activeShare = sharedSessionRef.current;
    if (!activeShare) return;
    await loadSharedByToken(activeShare.token);
    onNotify("Kanvas preview diperbarui dari server.", "info");
  }, [loadSharedByToken, onNotify]);

  const forkSharedToLocal = useCallback(async () => {
    const current = activeWorkspaceRef.current;
    if (!current) return;
    const api = apiRef.current;
    const elements = api
      ? api.getSceneElementsIncludingDeleted()
      : current.elements;
    const appState = api ? api.getAppState() : current.appState;
    const files = api ? api.getFiles() : current.files;

    const created = await manager.createNewWorkspace({
      title: `${current.title} (Salinan)`.slice(0, 120),
      folder: "",
      storageMode: "local",
      elements,
      appState: local.extractPersistedAppState(appState),
      files,
      thumbnail: current.thumbnail,
    });
    clearShareTokenFromUrl();
    sharedSessionRef.current = null;
    setSharedSession(null);
    setSharedError(null);
    mountWorkspaceSession(created);
    onNotify(`Salinan "${created.title}" disimpan ke My Canvas.`, "success");
  }, [mountWorkspaceSession, onNotify]);

  const exitSharedSession = useCallback(async () => {
    clearShareTokenFromUrl();
    sharedSessionRef.current = null;
    setSharedSession(null);
    setSharedError(null);
    setIsLoadingShared(false);
    const ws = await manager.ensureInitialWorkspace();
    mountWorkspaceSession(ws);
  }, [mountWorkspaceSession]);

  return {
    activeWorkspace,
    sessionKey,
    initialData,
    syncStatus,
    isOnline,
    conflict,
    sharedSession,
    sharedError,
    isLoadingShared,
    apiRef,
    setExcalidrawAPI,
    handleSceneChange,
    forceSave,
    prepareDrawerOpen,
    switchWorkspace,
    createNewCanvas,
    renameActiveWorkspace,
    renameAnyWorkspace,
    moveWorkspaceFolder,
    moveToDatabase,
    moveToLocal,
    duplicateAnyWorkspace,
    deleteAnyWorkspace,
    importExcalidrawFile,
    syncAllFromCloud,
    configureShare,
    refreshSharedWorkspace,
    forkSharedToLocal,
    exitSharedSession,
    resolveConflict,
    dismissConflict: () => setConflict(null),
  };
}
