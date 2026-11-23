import { exportToBlob } from "@excalidraw/excalidraw";
import type {
  BinaryFiles,
  NonDeletedExcalidrawElement,
  PersistedAppState,
} from "../types/workspace";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Gagal mengonversi thumbnail ke DataURL"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

export async function generateWorkspaceThumbnail(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<PersistedAppState, "viewBackgroundColor" | "theme">,
  files: BinaryFiles,
): Promise<string | null> {
  const activeElements = elements.filter((el) => !el.isDeleted);
  if (activeElements.length === 0) return null;

  try {
    const blob = await exportToBlob({
      elements: activeElements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
        exportBackground: true,
        exportWithDarkMode: appState.theme === "dark",
      },
      files,
      maxWidthOrHeight: 320,
      mimeType: "image/webp",
      quality: 0.72,
      exportPadding: 12,
    });
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}
