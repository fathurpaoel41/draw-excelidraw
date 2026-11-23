import { exportToBlob } from "@excalidraw/excalidraw";
import type {
  BinaryFiles,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "../types/workspace";

export async function renderSceneToPngBlob(params: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  viewBackgroundColor: string;
  includeBackground: boolean;
  darkMode: boolean;
  scale: 1 | 2 | 3;
  exportingFrame?: ExcalidrawFrameLikeElement | null;
}): Promise<Blob> {
  const activeElements = params.elements.filter((el) => !el.isDeleted);
  if (activeElements.length === 0) {
    throw new Error("Kanvas masih kosong.");
  }

  return exportToBlob({
    elements: activeElements,
    appState: {
      viewBackgroundColor: params.viewBackgroundColor || "#ffffff",
      exportBackground: params.includeBackground,
      exportWithDarkMode: params.darkMode,
      exportScale: params.scale,
    },
    files: params.files,
    mimeType: "image/png",
    exportPadding: 20,
    exportingFrame: params.exportingFrame ?? undefined,
    getDimensions: (width: number, height: number) => ({
      width: Math.max(1, Math.round(width * params.scale)),
      height: Math.max(1, Math.round(height * params.scale)),
      scale: params.scale,
    }),
  });
}

export async function exportSceneToPng(params: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  viewBackgroundColor: string;
  darkMode: boolean;
  filename: string;
  includeBackground?: boolean;
  scale?: 1 | 2 | 3;
}): Promise<string> {
  const blob = await renderSceneToPngBlob({
    elements: params.elements,
    files: params.files,
    viewBackgroundColor: params.viewBackgroundColor,
    includeBackground: params.includeBackground ?? true,
    darkMode: params.darkMode,
    scale: params.scale ?? 2,
  });

  const safeName = (params.filename.trim() || "drawing")
    .replace(/\.png$/i, "")
    .replace(/[\\/:*?"<>|]/g, "-");
  const finalName = `${safeName}.png`;

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return finalName;
}
