import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  FileId,
  FontFamilyValues,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
  Theme,
} from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
  UIAppState,
} from "@excalidraw/excalidraw/types";

export type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawImperativeAPI,
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
  Theme,
  UIAppState,
};

export type StorageMode = "local" | "cloud";

export type SyncStatus =
  "local_only" | "synced" | "saving" | "pending" | "conflict" | "error";

export interface PersistedAppState {
  viewBackgroundColor: string;
  theme: Theme;
  gridSize: number;
  gridModeEnabled?: boolean;
  scrollX?: number;
  scrollY?: number;
  zoom?: AppState["zoom"];
  currentItemFontFamily?: FontFamilyValues;
  currentItemStrokeColor?: string;
  currentItemBackgroundColor?: string;
  currentItemRoughness?: number;
  currentItemStrokeWidth?: number;
}

export interface WorkspaceRecord {
  id: string;
  title: string;
  folder: string;
  storageMode: StorageMode;
  remoteId: string | null;
  elements: readonly OrderedExcalidrawElement[];
  appState: PersistedAppState;
  thumbnail: string | null;
  elementCount: number;
  version: number;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceWithFiles extends WorkspaceRecord {
  files: BinaryFiles;
}

export type WorkspaceSummary = Omit<WorkspaceRecord, "elements" | "appState">;

export interface StoredFileRecord {
  key: string;
  id: FileId;
  workspaceId: string;
  mimeType: BinaryFileData["mimeType"];
  dataURL: DataURL;
  sizeBytes: number;
  createdAt: number;
}

export interface FolderEntry {
  name: string;
  createdAt: string;
}

export interface FolderWithCount {
  name: string;
  count: number;
}

export interface SettingEntry {
  key: string;
  value: string;
}

export interface ExportPdfOptions {
  filename: string;
  includeBackground: boolean;
  darkMode: boolean;
  scale: 1 | 2 | 3;
  pageSize: "fit" | "a4" | "a3" | "letter";
  orientation: "auto" | "landscape" | "portrait";
  multiPageByFrame: boolean;
}

export interface CloudWorkspaceSummary {
  id: string;
  user_id: number;
  judul: string;
  folder: string;
  thumbnail: string | null;
  versi: number;
  jumlah_elemen: number;
  dibuat: string;
  diperbarui: string;
}

export interface CloudWorkspaceDetail {
  id: string;
  user_id: number;
  judul: string;
  folder: string;
  elements: readonly OrderedExcalidrawElement[];
  app_state: Partial<PersistedAppState>;
  thumbnail: string | null;
  versi: number;
  dibuat: string;
  diperbarui: string;
  files: Record<
    string,
    {
      id: string;
      mimeType: BinaryFileData["mimeType"];
      dataURL: DataURL;
      created: number;
    }
  >;
}

export interface CloudFolderSummary {
  folder: string;
  jumlah: number;
}

export type StorageFilter = "all" | StorageMode;

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "success" | "warning" | "error";
}
