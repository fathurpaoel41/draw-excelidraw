import { apiRequest } from "../lib/api";
import type {
  BinaryFiles,
  CloudFolderSummary,
  CloudWorkspaceDetail,
  CloudWorkspaceSummary,
  OrderedExcalidrawElement,
  PersistedAppState,
  ShareConfigResponse,
  SharePermission,
  SharedWorkspaceDetail,
} from "../types/workspace";

export async function listWorkspaces(params?: {
  q?: string;
  folder?: string;
}): Promise<CloudWorkspaceSummary[]> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.folder !== undefined) query.set("folder", params.folder);
  const qs = query.toString();
  return apiRequest<CloudWorkspaceSummary[]>(
    `/api/draw/workspaces${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}

export async function listFolders(): Promise<CloudFolderSummary[]> {
  return apiRequest<CloudFolderSummary[]>("/api/draw/folders", {
    method: "GET",
  });
}

export async function renameFolder(
  folderLama: string,
  folderBaru: string,
): Promise<{ folder_lama: string; folder_baru: string; diperbarui: number }> {
  return apiRequest("/api/draw/folders", {
    method: "PATCH",
    body: JSON.stringify({
      folder_lama: folderLama,
      folder_baru: folderBaru,
    }),
  });
}

export async function getWorkspace(id: string): Promise<CloudWorkspaceDetail> {
  return apiRequest<CloudWorkspaceDetail>(`/api/draw/workspaces/${id}`, {
    method: "GET",
  });
}

export async function createWorkspace(payload: {
  judul: string;
  folder: string;
  elements: readonly OrderedExcalidrawElement[];
  app_state: Partial<PersistedAppState>;
  thumbnail: string | null;
  files: BinaryFiles;
}): Promise<CloudWorkspaceDetail> {
  return apiRequest<CloudWorkspaceDetail>("/api/draw/workspaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorkspace(
  id: string,
  payload: {
    judul?: string;
    folder?: string;
    elements: readonly OrderedExcalidrawElement[];
    app_state: Partial<PersistedAppState>;
    thumbnail?: string | null;
    expected_version?: number;
    files?: BinaryFiles;
  },
): Promise<CloudWorkspaceDetail> {
  return apiRequest<CloudWorkspaceDetail>(`/api/draw/workspaces/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateWorkspaceMeta(
  id: string,
  payload: { judul?: string; folder?: string },
): Promise<CloudWorkspaceDetail> {
  return apiRequest<CloudWorkspaceDetail>(`/api/draw/workspaces/${id}/meta`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function duplicateWorkspace(
  id: string,
): Promise<CloudWorkspaceDetail> {
  return apiRequest<CloudWorkspaceDetail>(
    `/api/draw/workspaces/${id}/duplicate`,
    { method: "POST" },
  );
}

export async function deleteWorkspace(id: string): Promise<void> {
  await apiRequest<{ id: string; status: string }>(
    `/api/draw/workspaces/${id}`,
    { method: "DELETE" },
  );
}

export async function updateWorkspaceShare(
  id: string,
  payload: {
    enabled: boolean;
    permission?: SharePermission;
    regenerate?: boolean;
  },
): Promise<ShareConfigResponse> {
  return apiRequest<ShareConfigResponse>(`/api/draw/workspaces/${id}/share`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getSharedWorkspace(
  token: string,
): Promise<SharedWorkspaceDetail> {
  return apiRequest<SharedWorkspaceDetail>(
    `/api/draw/shared/${encodeURIComponent(token)}`,
    { method: "GET", auth: false },
  );
}

export async function updateSharedWorkspace(
  token: string,
  payload: {
    judul?: string;
    elements: readonly OrderedExcalidrawElement[];
    app_state: Partial<PersistedAppState>;
    thumbnail?: string | null;
    expected_version?: number;
    files?: BinaryFiles;
  },
): Promise<SharedWorkspaceDetail> {
  return apiRequest<SharedWorkspaceDetail>(
    `/api/draw/shared/${encodeURIComponent(token)}`,
    {
      method: "PUT",
      auth: false,
      body: JSON.stringify(payload),
    },
  );
}
