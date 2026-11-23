import { exportToBlob } from "@excalidraw/excalidraw";
import { jsPDF } from "jspdf";
import { renderSceneToPngBlob } from "./exportPng";
import type {
  BinaryFiles,
  ExcalidrawFrameLikeElement,
  ExportPdfOptions,
  NonDeletedExcalidrawElement,
} from "../types/workspace";

const PAGE_DIMENSIONS_MM: Record<
  Exclude<ExportPdfOptions["pageSize"], "fit">,
  [number, number]
> = {
  a4: [210, 297],
  a3: [297, 420],
  letter: [215.9, 279.4],
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca blob gambar"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

function loadImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: Math.max(1, img.naturalWidth || img.width),
        height: Math.max(1, img.naturalHeight || img.height),
      });
    img.onerror = () => reject(new Error("Gagal memuat gambar hasil export"));
    img.src = dataUrl;
  });
}

export function getSortedFrames(
  elements: readonly NonDeletedExcalidrawElement[],
): ExcalidrawFrameLikeElement[] {
  return elements
    .filter(
      (el): el is ExcalidrawFrameLikeElement =>
        !el.isDeleted && (el.type === "frame" || el.type === "magicframe"),
    )
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
      return a.x - b.x;
    });
}

async function renderSceneToPngDataUrl(params: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  viewBackgroundColor: string;
  includeBackground: boolean;
  darkMode: boolean;
  scale: 1 | 2 | 3;
  exportingFrame?: ExcalidrawFrameLikeElement | null;
}): Promise<{ dataUrl: string; width: number; height: number }> {
  const blob = await renderSceneToPngBlob(params);
  const dataUrl = await blobToDataUrl(blob);
  const dims = await loadImageDimensions(dataUrl);
  return { dataUrl, ...dims };
}

export async function generatePdfPreviewDataUrl(params: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  viewBackgroundColor: string;
  includeBackground: boolean;
  darkMode: boolean;
}): Promise<string | null> {
  const active = params.elements.filter((el) => !el.isDeleted);
  if (active.length === 0) return null;

  const blob = await exportToBlob({
    elements: active,
    appState: {
      viewBackgroundColor: params.viewBackgroundColor || "#ffffff",
      exportBackground: params.includeBackground,
      exportWithDarkMode: params.darkMode,
    },
    files: params.files,
    mimeType: "image/png",
    maxWidthOrHeight: 900,
    exportPadding: 20,
  });

  return blobToDataUrl(blob);
}

function addImagePageToPdf(
  pdf: jsPDF | null,
  image: { dataUrl: string; width: number; height: number },
  options: ExportPdfOptions,
  backgroundHex: string,
): jsPDF {
  const isLandscapeImage = image.width >= image.height;
  const pxToMm = 25.4 / (96 * options.scale);
  const imgWidthMm = Math.max(20, image.width * pxToMm);
  const imgHeightMm = Math.max(20, image.height * pxToMm);

  let pageOrientation: "l" | "p";
  let pageWidthMm: number;
  let pageHeightMm: number;

  if (options.pageSize === "fit") {
    const paddingMm = 8;
    pageWidthMm = imgWidthMm + paddingMm * 2;
    pageHeightMm = imgHeightMm + paddingMm * 2;
    pageOrientation = pageWidthMm >= pageHeightMm ? "l" : "p";
  } else {
    const [shortSide, longSide] = PAGE_DIMENSIONS_MM[options.pageSize];
    if (options.orientation === "auto") {
      pageOrientation = isLandscapeImage ? "l" : "p";
    } else {
      pageOrientation = options.orientation === "landscape" ? "l" : "p";
    }
    pageWidthMm = pageOrientation === "l" ? longSide : shortSide;
    pageHeightMm = pageOrientation === "l" ? shortSide : longSide;
  }

  let doc: jsPDF;
  if (!pdf) {
    doc = new jsPDF({
      orientation: pageOrientation,
      unit: "mm",
      format:
        options.pageSize === "fit"
          ? [pageWidthMm, pageHeightMm]
          : options.pageSize,
      compress: true,
    });
  } else {
    doc = pdf;
    doc.addPage(
      options.pageSize === "fit"
        ? [pageWidthMm, pageHeightMm]
        : options.pageSize,
      pageOrientation,
    );
  }

  if (options.includeBackground) {
    const fillHex = options.darkMode ? "#121212" : backgroundHex || "#ffffff";
    doc.setFillColor(fillHex);
    doc.rect(0, 0, pageWidthMm, pageHeightMm, "F");
  }

  const marginMm = options.pageSize === "fit" ? 8 : 10;
  const availWidth = Math.max(10, pageWidthMm - marginMm * 2);
  const availHeight = Math.max(10, pageHeightMm - marginMm * 2);
  const ratio = image.width / image.height;

  let drawWidth = availWidth;
  let drawHeight = drawWidth / ratio;
  if (drawHeight > availHeight) {
    drawHeight = availHeight;
    drawWidth = drawHeight * ratio;
  }

  const x = (pageWidthMm - drawWidth) / 2;
  const y = (pageHeightMm - drawHeight) / 2;

  doc.addImage(
    image.dataUrl,
    "PNG",
    x,
    y,
    drawWidth,
    drawHeight,
    undefined,
    "FAST",
  );
  return doc;
}

export async function exportSceneToPdf(params: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  viewBackgroundColor: string;
  options: ExportPdfOptions;
}): Promise<void> {
  const { elements, files, viewBackgroundColor, options } = params;
  const activeElements = elements.filter((el) => !el.isDeleted);
  if (activeElements.length === 0) {
    throw new Error("Kanvas masih kosong untuk diexport ke PDF.");
  }

  const frames = options.multiPageByFrame
    ? getSortedFrames(activeElements)
    : [];
  let doc: jsPDF | null = null;

  if (frames.length > 0) {
    for (const frame of frames) {
      const rendered = await renderSceneToPngDataUrl({
        elements: activeElements,
        files,
        viewBackgroundColor,
        includeBackground: options.includeBackground,
        darkMode: options.darkMode,
        scale: options.scale,
        exportingFrame: frame,
      });
      doc = addImagePageToPdf(doc, rendered, options, viewBackgroundColor);
    }
  } else {
    const rendered = await renderSceneToPngDataUrl({
      elements: activeElements,
      files,
      viewBackgroundColor,
      includeBackground: options.includeBackground,
      darkMode: options.darkMode,
      scale: options.scale,
    });
    doc = addImagePageToPdf(doc, rendered, options, viewBackgroundColor);
  }

  const safeName = (options.filename.trim() || "drawing")
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]/g, "-");

  doc?.save(`${safeName}.pdf`);
}
