import { db } from "../lib/db";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  FolderWithCount,
  OrderedExcalidrawElement,
  PersistedAppState,
  SharePermission,
  StorageMode,
  StoredFileRecord,
  SyncStatus,
  WorkspaceRecord,
  WorkspaceWithFiles,
} from "../types/workspace";

const SETTING_LAST_ACTIVE = "last_active_workspace_id";

export const DEFAULT_PERSISTED_APP_STATE: PersistedAppState = {
  viewBackgroundColor: "#ffffff",
  theme: "light",
  gridSize: 20,
  gridModeEnabled: false,
};

export function extractPersistedAppState(
  appState: Partial<AppState> | Partial<PersistedAppState> | null | undefined,
): PersistedAppState {
  if (!appState) return { ...DEFAULT_PERSISTED_APP_STATE };
  return {
    viewBackgroundColor:
      typeof appState.viewBackgroundColor === "string"
        ? appState.viewBackgroundColor
        : "#ffffff",
    theme: appState.theme === "dark" ? "dark" : "light",
    gridSize: typeof appState.gridSize === "number" ? appState.gridSize : 20,
    gridModeEnabled: Boolean(appState.gridModeEnabled),
    scrollX:
      typeof appState.scrollX === "number" ? appState.scrollX : undefined,
    scrollY:
      typeof appState.scrollY === "number" ? appState.scrollY : undefined,
    zoom:
      appState.zoom && typeof appState.zoom.value === "number"
        ? appState.zoom
        : undefined,
    currentItemFontFamily:
      typeof appState.currentItemFontFamily === "number"
        ? appState.currentItemFontFamily
        : undefined,
    currentItemStrokeColor:
      typeof appState.currentItemStrokeColor === "string"
        ? appState.currentItemStrokeColor
        : undefined,
    currentItemBackgroundColor:
      typeof appState.currentItemBackgroundColor === "string"
        ? appState.currentItemBackgroundColor
        : undefined,
    currentItemRoughness:
      typeof appState.currentItemRoughness === "number"
        ? appState.currentItemRoughness
        : undefined,
    currentItemStrokeWidth:
      typeof appState.currentItemStrokeWidth === "number"
        ? appState.currentItemStrokeWidth
        : undefined,
  };
}

export function filterReferencedFiles(
  elements: readonly OrderedExcalidrawElement[],
  files: BinaryFiles,
): BinaryFiles {
  const referencedIds = new Set<string>();
  for (const el of elements) {
    if (el.type === "image" && el.fileId) {
      referencedIds.add(el.fileId);
    }
  }
  const filtered: BinaryFiles = {};
  for (const [id, fileData] of Object.entries(files)) {
    if (referencedIds.has(id) && fileData) {
      filtered[id] = fileData;
    }
  }
  return filtered;
}

export async function getLastActiveWorkspaceId(): Promise<string | null> {
  const row = await db.settings.get(SETTING_LAST_ACTIVE);
  return row?.value ?? null;
}

export async function setLastActiveWorkspaceId(id: string): Promise<void> {
  await db.settings.put({ key: SETTING_LAST_ACTIVE, value: id });
}

export async function getWorkspaceFiles(
  workspaceId: string,
): Promise<BinaryFiles> {
  const rows = await db.files
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  const files: BinaryFiles = {};
  for (const row of rows) {
    const fileData: BinaryFileData = {
      id: row.id,
      mimeType: row.mimeType,
      dataURL: row.dataURL,
      created: row.createdAt,
    };
    files[row.id] = fileData;
  }
  return files;
}

export async function syncWorkspaceFiles(
  workspaceId: string,
  files: BinaryFiles,
): Promise<void> {
  const entries = Object.values(files).filter((f): f is BinaryFileData =>
    Boolean(f && f.id && f.dataURL),
  );
  const keepKeys = new Set(entries.map((f) => `${workspaceId}:${f.id}`));

  const existing = await db.files
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  const toDelete = existing
    .filter((row) => !keepKeys.has(row.key))
    .map((row) => row.key);

  if (toDelete.length > 0) {
    await db.files.bulkDelete(toDelete);
  }

  if (entries.length > 0) {
    const records: StoredFileRecord[] = entries.map((f) => ({
      key: `${workspaceId}:${f.id}`,
      id: f.id,
      workspaceId,
      mimeType: f.mimeType,
      dataURL: f.dataURL,
      sizeBytes: f.dataURL.length,
      createdAt: f.created || Date.now(),
    }));
    await db.files.bulkPut(records);
  }
}

export async function getWorkspace(
  id: string,
): Promise<WorkspaceWithFiles | null> {
  const ws = await db.workspaces.get(id);
  if (!ws) return null;
  const files = await getWorkspaceFiles(id);
  return { ...ws, files };
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  return db.workspaces.orderBy("updatedAt").reverse().toArray();
}

export async function listFolders(): Promise<FolderWithCount[]> {
  const [savedFolders, allWorkspaces] = await Promise.all([
    db.folders.toArray(),
    db.workspaces.toArray(),
  ]);

  const counts = new Map<string, number>();
  for (const folder of savedFolders) {
    const trimmed = folder.name.trim();
    if (trimmed) counts.set(trimmed, 0);
  }
  for (const ws of allWorkspaces) {
    const folder = ws.folder.trim();
    if (folder) {
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function createFolder(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error("Nama folder tidak boleh kosong.");
  await db.folders.put({
    name: trimmed,
    createdAt: new Date().toISOString(),
  });
}

export async function renameFolder(
  oldName: string,
  newName: string,
): Promise<void> {
  const from = oldName.trim();
  const to = newName.trim().slice(0, 60);
  if (!from || !to || from === to) return;

  await db.transaction("rw", db.folders, db.workspaces, async () => {
    const existing = await db.folders.get(from);
    await db.folders.delete(from);
    await db.folders.put({
      name: to,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });

    const affected = await db.workspaces.where("folder").equals(from).toArray();
    const now = new Date().toISOString();
    for (const ws of affected) {
      await db.workspaces.update(ws.id, {
        folder: to,
        updatedAt: now,
        syncStatus:
          ws.storageMode === "cloud"
            ? ("pending" as SyncStatus)
            : ws.syncStatus,
      });
    }
  });
}

export async function deleteFolder(name: string): Promise<void> {
  const target = name.trim();
  if (!target) return;

  await db.transaction("rw", db.folders, db.workspaces, async () => {
    await db.folders.delete(target);
    const affected = await db.workspaces
      .where("folder")
      .equals(target)
      .toArray();
    const now = new Date().toISOString();
    for (const ws of affected) {
      await db.workspaces.update(ws.id, {
        folder: "",
        updatedAt: now,
        syncStatus:
          ws.storageMode === "cloud"
            ? ("pending" as SyncStatus)
            : ws.syncStatus,
      });
    }
  });
}

export async function createLocalWorkspace(params?: {
  id?: string;
  title?: string;
  folder?: string;
  storageMode?: StorageMode;
  remoteId?: string | null;
  elements?: readonly OrderedExcalidrawElement[];
  appState?: Partial<PersistedAppState>;
  files?: BinaryFiles;
  thumbnail?: string | null;
  version?: number;
  syncStatus?: SyncStatus;
  shareEnabled?: boolean;
  sharePermission?: SharePermission;
  shareToken?: string | null;
}): Promise<WorkspaceWithFiles> {
  const now = new Date().toISOString();
  const id = params?.id ?? crypto.randomUUID();
  const folder = (params?.folder ?? "").trim().slice(0, 60);
  const elements = params?.elements ? [...params.elements] : [];
  const files = params?.files
    ? filterReferencedFiles(elements, params.files)
    : {};

  if (folder) {
    await createFolder(folder);
  }

  const record: WorkspaceRecord = {
    id,
    title:
      (params?.title ?? "Tanpa Judul").trim().slice(0, 120) || "Tanpa Judul",
    folder,
    storageMode: params?.storageMode ?? "local",
    remoteId: params?.remoteId ?? null,
    elements,
    appState: extractPersistedAppState(params?.appState),
    thumbnail: params?.thumbnail ?? null,
    elementCount: elements.filter((el) => !el.isDeleted).length,
    version: params?.version ?? 1,
    syncStatus: params?.syncStatus ?? "local_only",
    shareEnabled: params?.shareEnabled ?? false,
    sharePermission: params?.sharePermission ?? "readonly",
    shareToken: params?.shareToken ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction("rw", db.workspaces, db.files, async () => {
    await db.workspaces.put(record);
    await syncWorkspaceFiles(id, files);
  });

  return { ...record, files };
}

export async function saveLocalWorkspace(
  id: string,
  patch: {
    title?: string;
    folder?: string;
    elements?: readonly OrderedExcalidrawElement[];
    appState?: Partial<AppState> | Partial<PersistedAppState>;
    files?: BinaryFiles;
    thumbnail?: string | null;
    version?: number;
    syncStatus?: SyncStatus;
    storageMode?: StorageMode;
    remoteId?: string | null;
    shareEnabled?: boolean;
    sharePermission?: SharePermission;
    shareToken?: string | null;
    updatedAt?: string;
  },
): Promise<WorkspaceWithFiles | null> {
  const existing = await db.workspaces.get(id);
  if (!existing) return null;

  const elements = patch.elements ? [...patch.elements] : existing.elements;
  const nextFiles = patch.files
    ? filterReferencedFiles(elements, patch.files)
    : await getWorkspaceFiles(id);

  const nextFolder =
    patch.folder !== undefined
      ? patch.folder.trim().slice(0, 60)
      : existing.folder;
  if (nextFolder) {
    await createFolder(nextFolder);
  }

  const nextRecord: WorkspaceRecord = {
    ...existing,
    title:
      patch.title !== undefined
        ? patch.title.trim().slice(0, 120) || "Tanpa Judul"
        : existing.title,
    folder: nextFolder,
    elements,
    appState:
      patch.appState !== undefined
        ? extractPersistedAppState(patch.appState)
        : existing.appState,
    thumbnail:
      patch.thumbnail !== undefined ? patch.thumbnail : existing.thumbnail,
    elementCount: elements.filter((el) => !el.isDeleted).length,
    version: patch.version ?? existing.version,
    syncStatus: patch.syncStatus ?? existing.syncStatus,
    storageMode: patch.storageMode ?? existing.storageMode,
    remoteId: patch.remoteId !== undefined ? patch.remoteId : existing.remoteId,
    shareEnabled:
      patch.shareEnabled !== undefined
        ? patch.shareEnabled
        : existing.shareEnabled,
    sharePermission:
      patch.sharePermission !== undefined
        ? patch.sharePermission
        : existing.sharePermission,
    shareToken:
      patch.shareToken !== undefined ? patch.shareToken : existing.shareToken,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };

  await db.transaction("rw", db.workspaces, db.files, async () => {
    await db.workspaces.put(nextRecord);
    if (patch.files !== undefined || patch.elements !== undefined) {
      await syncWorkspaceFiles(id, nextFiles);
    }
  });

  return { ...nextRecord, files: nextFiles };
}

export async function deleteLocalWorkspace(id: string): Promise<void> {
  await db.transaction("rw", db.workspaces, db.files, async () => {
    await db.workspaces.delete(id);
    await db.files.where("workspaceId").equals(id).delete();
  });
}

export async function duplicateLocalWorkspace(
  id: string,
): Promise<WorkspaceWithFiles | null> {
  const source = await getWorkspace(id);
  if (!source) return null;

  return createLocalWorkspace({
    title: `${source.title} (Salinan)`.slice(0, 120),
    folder: source.folder,
    storageMode: "local",
    remoteId: null,
    elements: source.elements,
    appState: source.appState,
    files: source.files,
    thumbnail: source.thumbnail,
    syncStatus: "local_only",
  });
}
