import Dexie, { type EntityTable } from "dexie";
import type {
  FolderEntry,
  SettingEntry,
  StoredFileRecord,
  WorkspaceRecord,
} from "../types/workspace";

class DrawLocalDatabase extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  files!: EntityTable<StoredFileRecord, "key">;
  folders!: EntityTable<FolderEntry, "name">;
  settings!: EntityTable<SettingEntry, "key">;

  constructor() {
    super("draw_local_db");
    this.version(1).stores({
      workspaces: "id, title, folder, storageMode, remoteId, updatedAt",
      files: "key, workspaceId, id",
      folders: "name, createdAt",
      settings: "key",
    });
  }
}

export const db = new DrawLocalDatabase();
