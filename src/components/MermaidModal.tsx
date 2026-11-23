import {
  CaptureUpdateAction,
  exportToSvg,
  getCommonBounds,
} from "@excalidraw/excalidraw";
import { AlertCircle, Plus, Replace, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { convertMermaidCode, MERMAID_TEMPLATES } from "../lib/mermaid";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  OrderedExcalidrawElement,
  Theme,
} from "../types/workspace";
import { AppSelect, type SelectOption } from "./AppSelect";

const FONT_SIZE_OPTIONS: readonly SelectOption<number>[] = [
  { value: 16, label: "16px" },
  { value: 20, label: "20px" },
  { value: 24, label: "24px" },
];

interface MermaidModalProps {
  open: boolean;
  theme: Theme;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
  onNotify: (
    text: string,
    tone?: "info" | "success" | "warning" | "error",
  ) => void;
}

export function MermaidModal({
  open,
  theme,
  excalidrawAPI,
  onClose,
  onNotify,
}: MermaidModalProps) {
  const [code, setCode] = useState<string>(MERMAID_TEMPLATES[0]?.code ?? "");
  const [fontSize, setFontSize] = useState<number>(20);
  const [elbow, setElbow] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  const [confirmReplace, setConfirmReplace] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    elements: OrderedExcalidrawElement[];
    files: BinaryFiles;
  } | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmReplace(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConverting(true);
    setErrorMsg(null);

    const timer = setTimeout(async () => {
      try {
        const result = await convertMermaidCode(code, { fontSize, elbow });
        if (cancelled) return;
        setPreviewData(result);

        const svg = await exportToSvg({
          elements: result.elements.filter((el) => !el.isDeleted),
          appState: {
            exportBackground: true,
            viewBackgroundColor: theme === "dark" ? "#121212" : "#ffffff",
            exportWithDarkMode: theme === "dark",
          },
          files: result.files,
          exportPadding: 16,
        });
        if (cancelled) return;
        svg.style.maxWidth = "100%";
        svg.style.maxHeight = "100%";
        svg.style.width = "auto";
        svg.style.height = "auto";
        previewRef.current?.replaceChildren(svg);
      } catch (err) {
        if (cancelled) return;
        setPreviewData(null);
        previewRef.current?.replaceChildren();
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Sintaks Mermaid tidak dapat diproses.",
        );
      } finally {
        if (!cancelled) setConverting(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, code, fontSize, elbow, theme]);

  if (!open) return null;

  const insertElements = async (mode: "append" | "replace") => {
    if (!excalidrawAPI) return;
    try {
      const converted =
        previewData ?? (await convertMermaidCode(code, { fontSize, elbow }));

      const existing = excalidrawAPI.getSceneElements();
      const nonDeletedExisting = existing.filter((el) => !el.isDeleted);

      if (
        mode === "replace" &&
        nonDeletedExisting.length > 0 &&
        !confirmReplace
      ) {
        setConfirmReplace(true);
        return;
      }

      let targetElements = converted.elements;

      if (mode === "append" && nonDeletedExisting.length > 0) {
        const [, exMinY, exMaxX] = getCommonBounds(nonDeletedExisting);
        const [newMinX, newMinY] = getCommonBounds(converted.elements);
        const offsetX = exMaxX + 80 - newMinX;
        const offsetY = exMinY - newMinY;

        targetElements = converted.elements.map((el) => ({
          ...el,
          x: el.x + offsetX,
          y: el.y + offsetY,
        }));
      }

      const fileValues = Object.values(converted.files);
      if (fileValues.length > 0) {
        excalidrawAPI.addFiles(fileValues);
      }

      const finalElements =
        mode === "append"
          ? [...nonDeletedExisting, ...targetElements]
          : targetElements;

      excalidrawAPI.updateScene({
        elements: finalElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      excalidrawAPI.scrollToContent(targetElements, {
        fitToContent: true,
        animate: true,
      });

      onNotify(
        mode === "append"
          ? "Diagram Mermaid ditambahkan ke kanvas."
          : "Isi kanvas diganti dengan diagram Mermaid.",
        "success",
      );
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal mengonversi Mermaid.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mermaid-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white text-[#1b1b1f] shadow-2xl dark:border-[#31303b] dark:bg-[#232329] dark:text-[#e3e3e8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3.5 dark:border-[#31303b]">
          <h2 id="mermaid-modal-title" className="text-base font-semibold">
            Mermaid to Excalidraw
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Mermaid"
            className="cursor-pointer rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1b1b1f] dark:text-[#9b9b9f] dark:hover:bg-[#2e2d39] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] bg-[#f8f9fa] px-5 py-2.5 dark:border-[#31303b] dark:bg-[#18181d]">
          <div className="flex flex-wrap items-center gap-1.5">
            {MERMAID_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setCode(tpl.code);
                  setConfirmReplace(false);
                }}
                className="cursor-pointer rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] transition hover:border-[#6965db] hover:text-[#6965db] dark:border-[#31303b] dark:bg-[#232329] dark:text-[#d4d4dc] dark:hover:border-[#6965db]"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-[#52525b] dark:text-[#b4b4c0]">
              <span>Font</span>
              <AppSelect<number>
                ariaLabel="Ukuran font Mermaid"
                value={fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={setFontSize}
                compact
                className="w-20"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 text-[#52525b] dark:text-[#b4b4c0]">
              <input
                type="checkbox"
                checked={elbow}
                onChange={(e) => setElbow(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-[#6965db]"
              />
              <span>Panah Siku</span>
            </label>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[#e5e7eb] md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-[#31303b]">
          <div className="flex min-h-[260px] flex-col p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="mermaid-code-editor"
                className="text-xs font-medium text-[#374151] dark:text-[#c7c7d1]"
              >
                Sintaks Mermaid
              </label>
              <span className="text-[11px] text-[#9ca3af]">⌘/Ctrl + Enter</span>
            </div>
            <textarea
              id="mermaid-code-editor"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setConfirmReplace(false);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void insertElements("append");
                  return;
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const next = `${code.slice(0, start)}  ${code.slice(end)}`;
                  setCode(next);
                  requestAnimationFrame(() => {
                    target.selectionStart = start + 2;
                    target.selectionEnd = start + 2;
                  });
                }
              }}
              spellCheck={false}
              className="min-h-[260px] flex-1 resize-none rounded-lg border border-[#d1d5db] bg-[#f8f9fa] p-3 font-mono text-xs leading-relaxed text-[#1b1b1f] outline-none focus:border-[#6965db] dark:border-[#31303b] dark:bg-[#18181d] dark:text-[#e3e3e8]"
              placeholder="flowchart LR&#10;  A[Start] --> B[End]"
            />
          </div>

          <div className="flex min-h-[260px] flex-col p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-[#374151] dark:text-[#c7c7d1]">
                Pratinjau
              </span>
              {converting && (
                <span className="text-[11px] text-[#6965db]">Merender...</span>
              )}
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-auto rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-4 dark:border-[#31303b] dark:bg-[#18181d]">
              {errorMsg ? (
                <div className="flex max-w-md flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  <AlertCircle className="h-4 w-4" />
                  <p className="font-medium">Sintaks Mermaid belum valid</p>
                  <p className="font-mono text-[11px] break-all opacity-90">
                    {errorMsg}
                  </p>
                </div>
              ) : (
                <div
                  ref={previewRef}
                  className="flex h-full w-full items-center justify-center"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3.5 dark:border-[#31303b]">
          {confirmReplace ? (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-300">
              Yakin ingin mengganti seluruh isi kanvas saat ini?
            </span>
          ) : (
            <span className="text-[11px] text-[#6b7280] dark:text-[#9b9b9f]">
              Elemen hasil konversi dapat diedit langsung di kanvas.
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-[#e5e7eb] px-3.5 py-2 text-xs font-medium hover:bg-[#f3f4f6] dark:border-[#31303b] dark:hover:bg-[#2e2d39]"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={Boolean(errorMsg) || !previewData}
              onClick={() => void insertElements("replace")}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition disabled:opacity-50 ${
                confirmReplace
                  ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
                  : "border-[#e5e7eb] bg-white hover:bg-[#f3f4f6] dark:border-[#31303b] dark:bg-[#232329] dark:hover:bg-[#2e2d39]"
              }`}
            >
              <Replace className="h-3.5 w-3.5" />
              {confirmReplace ? "Ya, Ganti" : "Ganti Kanvas"}
            </button>
            <button
              type="button"
              disabled={Boolean(errorMsg) || !previewData}
              onClick={() => void insertElements("append")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#5b57d1] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambahkan ke Kanvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
