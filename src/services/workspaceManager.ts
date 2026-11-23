import { ApiError } from "../lib/api";
import { IS_CLOUD_ENABLED } from "../lib/config";
import { db } from "../lib/db";
import type {
  AppState,
  BinaryFiles,
  CloudWorkspaceDetail,
  OrderedExcalidrawElement,
  PersistedAppState,
  StorageMode,
  WorkspaceRecord,
  WorkspaceWithFiles,
} from "../types/workspace";
import { isAuthenticated } from "./authService";
import * as cloud from "./cloudWorkspace";
import * as local from "./localWorkspace";

export type SaveWorkspaceOutcome =
  | { status: "ok"; workspace: WorkspaceWithFiles }
  | {
      status: "conflict";
      workspace: WorkspaceWithFiles;
      serverWorkspace: CloudWorkspaceDetail;
    };

let initialWorkspacePromise: Promise<WorkspaceWithFiles> | null = null;

export async function ensureInitialWorkspace(): Promise<WorkspaceWithFiles> {
  if (initialWorkspacePromise) return initialWorkspacePromise;

  initialWorkspacePromise = (async () => {
    const lastId = await local.getLastActiveWorkspaceId();
    if (lastId) {
      const existing = await local.getWorkspace(lastId);
      if (existing) return existing;
    }

    const all = await local.listWorkspaces();
    const first = all[0];
    if (first) {
      await local.setLastActiveWorkspaceId(first.id);
      const full = await local.getWorkspace(first.id);
      if (full) return full;
    }

    const created = await local.createLocalWorkspace({
      title: "Untitled Canvas",
      folder: "",
      storageMode: "local",
    });
    await local.setLastActiveWorkspaceId(created.id);
    return created;
  })().finally(() => {
    initialWorkspacePromise = null;
  });

  return initialWorkspacePromise;
}

export async function openWorkspace(
  id: string,
): Promise<WorkspaceWithFiles | null> {
  const cached = await local.getWorkspace(id);
  if (!cached) return null;

  await local.setLastActiveWorkspaceId(cached.id);

  // Jika canvas tersimpan di Database dan user sedang login, ambil versi terbaru jika tidak sedang pending/conflict
  if (
    IS_CLOUD_ENABLED &&
    cached.storageMode === "cloud" &&
    cached.remoteId &&
    isAuthenticated() &&
    navigator.onLine &&
    cached.syncStatus !== "pending" &&
    cached.syncStatus !== "conflict"
  ) {
    try {
      const remote = await cloud.getWorkspace(cached.remoteId);
      if (remote.versi >= cached.version) {
        const updated = await local.saveLocalWorkspace(cached.id, {
          title: remote.judul,
          folder: remote.folder,
          elements: remote.elements,
          appState: remote.app_state,
          files: remote.files as BinaryFiles,
          thumbnail: remote.thumbnail,
          version: remote.versi,
          syncStatus: "synced",
          updatedAt: remote.diperbarui,
        });
        if (updated) return updated;
      }
    } catch {
      // Tetap kembalikan cache IndexedDB agar tetap instan & offline-ready
    }
  }

  return cached;
}

export async function createNewWorkspace(params: {
  title?: string;
  folder?: string;
  storageMode?: StorageMode;
  elements?: readonly OrderedExcalidrawElement[];
  appState?: Partial<PersistedAppState>;
  files?: BinaryFiles;
  thumbnail?: string | null;
}): Promise<WorkspaceWithFiles> {
  const mode: StorageMode = IS_CLOUD_ENABLED
    ? (params.storageMode ?? "local")
    : "local";

  if (mode === "cloud") {
    if (!isAuthenticated()) {
      throw new Error(
        "Silakan masuk akun terlebih dahulu untuk menyimpan ke Database.",
      );
    }
    const elements = params.elements ?? [];
    const files = params.files
      ? local.filterReferencedFiles(elements, params.files)
      : {};
    const appState = local.extractPersistedAppState(params.appState);
    const createdRemote = await cloud.createWorkspace({
      judul: (params.title ?? "Tanpa Judul").trim() || "Tanpa Judul",
      folder: (params.folder ?? "").trim(),
      elements,
      app_state: appState,
      thumbnail: params.thumbnail ?? null,
      files,
    });

    const cached = await local.createLocalWorkspace({
      id: createdRemote.id,
      remoteId: createdRemote.id,
      title: createdRemote.judul,
      folder: createdRemote.folder,
      storageMode: "cloud",
      elements: createdRemote.elements,
      appState: createdRemote.app_state,
      files: createdRemote.files as BinaryFiles,
      thumbnail: createdRemote.thumbnail,
      version: createdRemote.versi,
      syncStatus: "synced",
    });
    await local.setLastActiveWorkspaceId(cached.id);
    return cached;
  }

  const createdLocal = await local.createLocalWorkspace({
    title: params.title ?? "Tanpa Judul",
    folder: params.folder ?? "",
    storageMode: "local",
    elements: params.elements,
    appState: params.appState,
    files: params.files,
    thumbnail: params.thumbnail,
  });
  await local.setLastActiveWorkspaceId(createdLocal.id);
  return createdLocal;
}

export async function saveWorkspace(
  id: string,
  payload: {
    title?: string;
    folder?: string;
    elements?: readonly OrderedExcalidrawElement[];
    appState?: Partial<AppState> | Partial<PersistedAppState>;
    files?: BinaryFiles;
    thumbnail?: string | null;
  },
  options: { syncCloud?: boolean } = {},
): Promise<SaveWorkspaceOutcome> {
  const existing = await local.getWorkspace(id);
  if (!existing) {
    throw new Error("Workspace tidak ditemukan di penyimpanan lokal.");
  }

  const isCloud =
    IS_CLOUD_ENABLED &&
    existing.storageMode === "cloud" &&
    Boolean(existing.remoteId);
  const shouldSyncCloud =
    isCloud &&
    (options.syncCloud ?? true) &&
    isAuthenticated() &&
    navigator.onLine;

  const savedLocal = await local.saveLocalWorkspace(id, {
    ...payload,
    syncStatus: isCloud
      ? shouldSyncCloud
        ? existing.syncStatus
        : "pending"
      : "local_only",
  });

  if (!savedLocal) {
    throw new Error("Gagal menyimpan ke IndexedDB.");
  }

  if (!shouldSyncCloud || !savedLocal.remoteId) {
    return { status: "ok", workspace: savedLocal };
  }

  try {
    const remote = await cloud.updateWorkspace(savedLocal.remoteId, {
      judul: savedLocal.title,
      folder: savedLocal.folder,
      elements: savedLocal.elements,
      app_state: savedLocal.appState,
      thumbnail: savedLocal.thumbnail,
      expected_version: savedLocal.version,
      files: savedLocal.files,
    });

    const synced = await local.saveLocalWorkspace(id, {
      version: remote.versi,
      syncStatus: "synced",
      updatedAt: remote.diperbarui,
    });

    return { status: "ok", workspace: synced ?? savedLocal };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const conflictData = err.data as
        { current?: CloudWorkspaceDetail } | undefined;
      if (conflictData?.current) {
        const conflicted = await local.saveLocalWorkspace(id, {
          syncStatus: "conflict",
        });
        return {
          status: "conflict",
          workspace: conflicted ?? savedLocal,
          serverWorkspace: conflictData.current,
        };
      }
    }

    const pending = await local.saveLocalWorkspace(id, {
      syncStatus: "pending",
    });
    return { status: "ok", workspace: pending ?? savedLocal };
  }
}

export async function updateWorkspaceMeta(
  id: string,
  meta: { title?: string; folder?: string },
): Promise<WorkspaceWithFiles | null> {
  const existing = await local.getWorkspace(id);
  if (!existing) return null;

  const updated = await local.saveLocalWorkspace(id, {
    title: meta.title,
    folder: meta.folder,
    syncStatus:
      IS_CLOUD_ENABLED && existing.storageMode === "cloud"
        ? "pending"
        : existing.syncStatus,
  });

  if (
    IS_CLOUD_ENABLED &&
    updated &&
    updated.storageMode === "cloud" &&
    updated.remoteId &&
    isAuthenticated() &&
    navigator.onLine
  ) {
    try {
      const remote = await cloud.updateWorkspaceMeta(updated.remoteId, {
        judul: meta.title,
        folder: meta.folder,
      });
      return (
        (await local.saveLocalWorkspace(id, {
          syncStatus: "synced",
          updatedAt: remote.diperbarui,
        })) ?? updated
      );
    } catch {
      return updated;
    }
  }

  return updated;
}

export async function moveWorkspaceToDatabase(
  id: string,
): Promise<WorkspaceWithFiles> {
  if (!IS_CLOUD_ENABLED) {
    throw new Error("Mode penyimpanan hanya Lokal (Database dinonaktifkan).");
  }
  if (!isAuthenticated()) {
    throw new Error("Masuk akun terlebih dahulu untuk menyimpan ke Database.");
  }
  const source = await local.getWorkspace(id);
  if (!source) {
    throw new Error("Canvas tidak ditemukan.");
  }

  if (source.storageMode === "cloud" && source.remoteId) {
    return source;
  }

  const remote = await cloud.createWorkspace({
    judul: source.title,
    folder: source.folder,
    elements: source.elements,
    app_state: source.appState,
    thumbnail: source.thumbnail,
    files: source.files,
  });

  const updated = await local.saveLocalWorkspace(id, {
    storageMode: "cloud",
    remoteId: remote.id,
    version: remote.versi,
    syncStatus: "synced",
    updatedAt: remote.diperbarui,
  });

  if (!updated) throw new Error("Gagal memperbarui status lokal.");
  return updated;
}

export async function moveWorkspaceToLocal(
  id: string,
  deleteFromDatabase: boolean,
): Promise<WorkspaceWithFiles> {
  const source = await local.getWorkspace(id);
  if (!source) throw new Error("Canvas tidak ditemukan.");

  if (
    IS_CLOUD_ENABLED &&
    deleteFromDatabase &&
    source.remoteId &&
    isAuthenticated()
  ) {
    try {
      await cloud.deleteWorkspace(source.remoteId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        throw err;
      }
    }
  }

  const updated = await local.saveLocalWorkspace(id, {
    storageMode: "local",
    remoteId: null,
    syncStatus: "local_only",
  });
  if (!updated) throw new Error("Gagal memindahkan canvas ke lokal.");
  return updated;
}

export async function duplicateWorkspace(
  id: string,
): Promise<WorkspaceWithFiles | null> {
  const source = await local.getWorkspace(id);
  if (!source) return null;

  if (
    IS_CLOUD_ENABLED &&
    source.storageMode === "cloud" &&
    source.remoteId &&
    isAuthenticated()
  ) {
    try {
      const dupRemote = await cloud.duplicateWorkspace(source.remoteId);
      return await local.createLocalWorkspace({
        id: dupRemote.id,
        remoteId: dupRemote.id,
        title: dupRemote.judul,
        folder: dupRemote.folder,
        storageMode: "cloud",
        elements: dupRemote.elements,
        appState: dupRemote.app_state,
        files: dupRemote.files as BinaryFiles,
        thumbnail: dupRemote.thumbnail,
        version: dupRemote.versi,
        syncStatus: "synced",
      });
    } catch {
      // Fallback duplikasi lokal jika sedang offline
    }
  }

  return local.duplicateLocalWorkspace(id);
}

export async function deleteWorkspace(id: string): Promise<void> {
  const source = await local.getWorkspace(id);
  if (!source) return;

  if (
    IS_CLOUD_ENABLED &&
    source.storageMode === "cloud" &&
    source.remoteId &&
    isAuthenticated()
  ) {
    try {
      await cloud.deleteWorkspace(source.remoteId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        throw err;
      }
    }
  }

  await local.deleteLocalWorkspace(id);
}

export async function renameFolderEverywhere(
  oldName: string,
  newName: string,
): Promise<void> {
  await local.renameFolder(oldName, newName);
  if (IS_CLOUD_ENABLED && isAuthenticated() && navigator.onLine) {
    try {
      await cloud.renameFolder(oldName, newName);
    } catch {
      // Perubahan tetap tersimpan lokal sebagai pending
    }
  }
}

export async function deleteFolderEverywhere(name: string): Promise<void> {
  await local.deleteFolder(name);
  if (IS_CLOUD_ENABLED && isAuthenticated() && navigator.onLine) {
    try {
      await cloud.renameFolder(name, "");
    } catch {
      // Perubahan tetap tersimpan lokal
    }
  }
}

export async function resolveConflictWithServer(
  localId: string,
  serverWorkspace: CloudWorkspaceDetail,
): Promise<WorkspaceWithFiles> {
  const updated = await local.saveLocalWorkspace(localId, {
    title: serverWorkspace.judul,
    folder: serverWorkspace.folder,
    elements: serverWorkspace.elements,
    appState: serverWorkspace.app_state,
    files: serverWorkspace.files as BinaryFiles,
    thumbnail: serverWorkspace.thumbnail,
    version: serverWorkspace.versi,
    syncStatus: "synced",
    updatedAt: serverWorkspace.diperbarui,
  });
  if (!updated) throw new Error("Gagal menerapkan versi Database.");
  return updated;
}

export async function resolveConflictOverwriteServer(
  localId: string,
  serverVersion: number,
): Promise<WorkspaceWithFiles> {
  const currentLocal = await local.getWorkspace(localId);
  if (!currentLocal || !currentLocal.remoteId) {
    throw new Error("Workspace lokal tidak valid.");
  }

  const remote = await cloud.updateWorkspace(currentLocal.remoteId, {
    judul: currentLocal.title,
    folder: currentLocal.folder,
    elements: currentLocal.elements,
    app_state: currentLocal.appState,
    thumbnail: currentLocal.thumbnail,
    expected_version: serverVersion,
    files: currentLocal.files,
  });

  const updated = await local.saveLocalWorkspace(localId, {
    version: remote.versi,
    syncStatus: "synced",
    updatedAt: remote.diperbarui,
  });
  return updated ?? currentLocal;
}

export async function resolveConflictSaveAsLocalCopy(
  localId: string,
  serverWorkspace: CloudWorkspaceDetail,
): Promise<{
  localCopy: WorkspaceWithFiles;
  syncedWorkspace: WorkspaceWithFiles;
}> {
  const currentLocal = await local.getWorkspace(localId);
  if (!currentLocal) throw new Error("Workspace lokal tidak ditemukan.");

  const localCopy = await local.createLocalWorkspace({
    title: `${currentLocal.title} (Konflik Lokal)`.slice(0, 120),
    folder: currentLocal.folder,
    storageMode: "local",
    elements: currentLocal.elements,
    appState: currentLocal.appState,
    files: currentLocal.files,
    thumbnail: currentLocal.thumbnail,
  });

  const syncedWorkspace = await resolveConflictWithServer(
    localId,
    serverWorkspace,
  );
  return { localCopy, syncedWorkspace };
}

export async function syncCloudToLocalCache(): Promise<number> {
  if (!IS_CLOUD_ENABLED || !isAuthenticated() || !navigator.onLine) return 0;

  // 1. Dorong dulu perubahan cloud yang tertunda saat offline
  const allLocal = await local.listWorkspaces();
  for (const ws of allLocal) {
    if (
      ws.storageMode === "cloud" &&
      ws.remoteId &&
      ws.syncStatus === "pending"
    ) {
      try {
        await saveWorkspace(ws.id, {}, { syncCloud: true });
      } catch {
        // Lanjutkan item berikutnya
      }
    }
  }

  // 2. Tarik daftar workspace & folder dari server
  const [remoteList, remoteFolders] = await Promise.all([
    cloud.listWorkspaces(),
    cloud.listFolders(),
  ]);

  for (const rf of remoteFolders) {
    if (rf.folder.trim()) {
      await local.createFolder(rf.folder);
    }
  }

  const refreshedLocal = await db.workspaces.toArray();
  const byRemoteId = new Map<string, WorkspaceRecord>();
  for (const item of refreshedLocal) {
    if (item.remoteId) {
      byRemoteId.set(item.remoteId, item);
    }
  }

  const remoteIdSet = new Set(remoteList.map((r) => r.id));

  // Hapus cache cloud lokal yang sudah dihapus di server (jika tidak punya perubahan pending/conflict)
  for (const item of refreshedLocal) {
    if (
      item.storageMode === "cloud" &&
      item.remoteId &&
      !remoteIdSet.has(item.remoteId) &&
      item.syncStatus === "synced"
    ) {
      await local.deleteLocalWorkspace(item.id);
    }
  }

  let syncedCount = 0;
  for (const remoteItem of remoteList) {
    const existing = byRemoteId.get(remoteItem.id);
    if (!existing) {
      // Tarik detail penuh jika baru pertama muncul di browser ini
      try {
        const detail = await cloud.getWorkspace(remoteItem.id);
        await local.createLocalWorkspace({
          id: detail.id,
          remoteId: detail.id,
          title: detail.judul,
          folder: detail.folder,
          storageMode: "cloud",
          elements: detail.elements,
          appState: detail.app_state,
          files: detail.files as BinaryFiles,
          thumbnail: detail.thumbnail,
          version: detail.versi,
          syncStatus: "synced",
        });
        syncedCount += 1;
      } catch {
        // Skip item yang gagal ditarik
      }
    } else if (
      remoteItem.versi > existing.version &&
      existing.syncStatus !== "pending" &&
      existing.syncStatus !== "conflict"
    ) {
      try {
        const detail = await cloud.getWorkspace(remoteItem.id);
        await local.saveLocalWorkspace(existing.id, {
          title: detail.judul,
          folder: detail.folder,
          elements: detail.elements,
          appState: detail.app_state,
          files: detail.files as BinaryFiles,
          thumbnail: detail.thumbnail,
          version: detail.versi,
          syncStatus: "synced",
          updatedAt: detail.diperbarui,
        });
        syncedCount += 1;
      } catch {
        // Skip
      }
    }
  }

  return syncedCount;
}
