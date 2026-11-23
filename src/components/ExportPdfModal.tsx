import { Download, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  exportSceneToPdf,
  generatePdfPreviewDataUrl,
  getSortedFrames,
} from "../lib/exportPdf";
import type {
  ExcalidrawImperativeAPI,
  ExportPdfOptions,
  Theme,
} from "../types/workspace";

interface ExportPdfModalProps {
  open: boolean;
  workspaceTitle: string;
  theme: Theme;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
  onNotify: (
    text: string,
    tone?: "info" | "success" | "warning" | "error",
  ) => void;
}

export function ExportPdfModal({
  open,
  workspaceTitle,
  theme,
  excalidrawAPI,
  onClose,
  onNotify,
}: ExportPdfModalProps) {
  const [options, setOptions] = useState<ExportPdfOptions>({
    filename: workspaceTitle || "drawing",
    includeBackground: true,
    darkMode: theme === "dark",
    scale: 2,
    pageSize: "fit",
    orientation: "auto",
    multiPageByFrame: false,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [exporting, setExporting] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setOptions((prev) => ({
      ...prev,
      filename: workspaceTitle || "drawing",
      darkMode: theme === "dark",
    }));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, workspaceTitle, theme, onClose]);

  useEffect(() => {
    if (!open || !excalidrawAPI) return;
    let active = true;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();

    const frames = getSortedFrames(elements);
    setFrameCount(frames.length);
    setPreviewError(null);

    generatePdfPreviewDataUrl({
      elements,
      files,
      viewBackgroundColor: appState.viewBackgroundColor,
      includeBackground: options.includeBackground,
      darkMode: options.darkMode,
    })
      .then((url) => {
        if (!active) return;
        setPreviewUrl(url);
        if (!url) {
          setPreviewError("Kanvas masih kosong.");
        }
      })
      .catch(() => {
        if (!active) return;
        setPreviewError("Gagal membuat pratinjau PDF.");
      });

    return () => {
      active = false;
    };
  }, [open, excalidrawAPI, options.includeBackground, options.darkMode]);

  if (!open) return null;

  const handleExport = async () => {
    if (!excalidrawAPI) return;
    setExporting(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      await exportSceneToPdf({
        elements,
        files,
        viewBackgroundColor: appState.viewBackgroundColor,
        options,
      });

      onNotify("PDF berhasil diunduh.", "success");
      onClose();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Gagal mengekspor PDF.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-[#e5e7eb] bg-white text-[#1b1b1f] shadow-2xl dark:border-[#31303b] dark:bg-[#232329] dark:text-[#e3e3e8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4 dark:border-[#31303b]">
          <h2 id="pdf-modal-title" className="text-base font-semibold">
            Export PDF
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog export PDF"
            className="cursor-pointer rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="flex flex-col gap-3 md:col-span-7">
            <div
              className={`flex h-64 items-center justify-center overflow-hidden rounded-lg border border-[#e5e7eb] p-4 dark:border-[#31303b] ${
                options.includeBackground
                  ? options.darkMode
                    ? "bg-[#121212]"
                    : "bg-white"
                  : "checkerboard-bg"
              }`}
            >
              {previewError ? (
                <p className="text-center text-xs text-[#6b7280] dark:text-[#9b9b9f]">
                  {previewError}
                </p>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Pratinjau Export PDF"
                  className="max-h-full max-w-full rounded object-contain"
                />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-[#6965db]" />
              )}
            </div>

            <div className="flex items-center overflow-hidden rounded-lg border border-[#d1d5db] focus-within:border-[#6965db] dark:border-[#3e3d4a]">
              <input
                id="pdf-filename-input"
                type="text"
                aria-label="Nama file PDF"
                value={options.filename}
                onChange={(e) =>
                  setOptions((p) => ({ ...p, filename: e.target.value }))
                }
                className="w-full bg-white px-3 py-2 text-xs font-medium outline-none dark:bg-[#18181d]"
                placeholder="nama-diagram"
              />
              <span className="border-l border-[#e5e7eb] bg-[#f8f9fa] px-3 py-2 text-xs font-medium text-[#6b7280] dark:border-[#31303b] dark:bg-[#18181d] dark:text-[#9b9b9f]">
                .pdf
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 md:col-span-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Background</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={options.includeBackground}
                  onClick={() =>
                    setOptions((p) => ({
                      ...p,
                      includeBackground: !p.includeBackground,
                    }))
                  }
                  className={`relative h-5 w-9 cursor-pointer rounded-full transition ${
                    options.includeBackground
                      ? "bg-[#6965db]"
                      : "bg-[#d1d5db] dark:bg-[#3e3d4a]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      options.includeBackground
                        ? "translate-x-4"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Dark mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={options.darkMode}
                  onClick={() =>
                    setOptions((p) => ({ ...p, darkMode: !p.darkMode }))
                  }
                  className={`relative h-5 w-9 cursor-pointer rounded-full transition ${
                    options.darkMode
                      ? "bg-[#6965db]"
                      : "bg-[#d1d5db] dark:bg-[#3e3d4a]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      options.darkMode ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium">Scale</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#e5e7eb] p-1 dark:border-[#31303b]">
                  {([1, 2, 3] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOptions((p) => ({ ...p, scale: s }))}
                      className={`cursor-pointer rounded-md py-1 text-xs font-medium transition ${
                        options.scale === s
                          ? "bg-[#6965db] text-white"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39]"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium">
                  Ukuran Halaman
                </span>
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-[#e5e7eb] p-1 dark:border-[#31303b]">
                  {(
                    [
                      { id: "fit", label: "Fit" },
                      { id: "a4", label: "A4" },
                      { id: "a3", label: "A3" },
                      { id: "letter", label: "Letter" },
                    ] as const
                  ).map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() =>
                        setOptions((p) => ({ ...p, pageSize: sz.id }))
                      }
                      className={`cursor-pointer rounded-md py-1 text-xs font-medium transition ${
                        options.pageSize === sz.id
                          ? "bg-[#6965db] text-white"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39]"
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              {options.pageSize !== "fit" && (
                <div>
                  <span className="mb-1.5 block text-xs font-medium">
                    Orientasi
                  </span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#e5e7eb] p-1 dark:border-[#31303b]">
                    {(
                      [
                        { id: "auto", label: "Auto" },
                        { id: "landscape", label: "Landscape" },
                        { id: "portrait", label: "Portrait" },
                      ] as const
                    ).map((or) => (
                      <button
                        key={or.id}
                        type="button"
                        onClick={() =>
                          setOptions((p) => ({ ...p, orientation: or.id }))
                        }
                        className={`cursor-pointer rounded-md py-1 text-xs font-medium transition ${
                          options.orientation === or.id
                            ? "bg-[#6965db] text-white"
                            : "text-[#6b7280] hover:bg-[#f3f4f6] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39]"
                        }`}
                      >
                        {or.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frameCount > 0 && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#e5e7eb] px-3 py-2.5 dark:border-[#31303b]">
                  <div>
                    <div className="text-xs font-medium">
                      Multi-Halaman per Frame
                    </div>
                    <div className="text-[11px] text-[#6b7280] dark:text-[#9b9b9f]">
                      {frameCount} frame ditemukan
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.multiPageByFrame}
                    onChange={(e) =>
                      setOptions((p) => ({
                        ...p,
                        multiPageByFrame: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded accent-[#6965db]"
                  />
                </label>
              )}
            </div>

            <button
              type="button"
              disabled={exporting || Boolean(previewError)}
              onClick={() => void handleExport()}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6965db] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#5b57d1] disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyiapkan PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
