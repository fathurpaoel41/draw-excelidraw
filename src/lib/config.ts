const rawEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env ?? {};

function resolveLocalOnly(): boolean {
  const localOnlyFlag = rawEnv.VITE_LOCAL_ONLY?.trim().toLowerCase();
  if (localOnlyFlag === "true") return true;
  if (localOnlyFlag === "false") return false;

  const enableDbFlag = rawEnv.VITE_ENABLE_DB?.trim().toLowerCase();
  if (enableDbFlag === "false") return true;
  if (enableDbFlag === "true") return false;

  const storageMode = rawEnv.VITE_STORAGE_MODE?.trim().toLowerCase();
  if (storageMode === "local") return true;
  if (
    storageMode === "server" ||
    storageMode === "cloud" ||
    storageMode === "db" ||
    storageMode === "dual"
  ) {
    return false;
  }

  return false;
}

export const IS_LOCAL_ONLY: boolean = resolveLocalOnly();
export const IS_CLOUD_ENABLED: boolean = !IS_LOCAL_ONLY;
export const APP_STORAGE_MODE: "local" | "server" = IS_LOCAL_ONLY
  ? "local"
  : "server";
