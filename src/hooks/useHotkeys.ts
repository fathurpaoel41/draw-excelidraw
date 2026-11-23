import { useEffect } from "react";

interface HotkeyHandlers {
  onForceSave: () => void;
  onToggleDrawer: () => void;
  onOpenMermaid: () => void;
  onOpenPdf: () => void;
  onNewCanvas: () => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return target.isContentEditable;
}

export function useHotkeys(handlers: HotkeyHandlers): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd/Ctrl + S selalu dicegah agar tidak memicu dialog "Save Webpage" browser
      if (mod && !e.shiftKey && !e.altKey && key === "s") {
        e.preventDefault();
        handlers.onForceSave();
        return;
      }

      if (mod && e.shiftKey && !e.altKey) {
        if (key === "w") {
          e.preventDefault();
          handlers.onToggleDrawer();
          return;
        }
        if (key === "m") {
          e.preventDefault();
          handlers.onOpenMermaid();
          return;
        }
        if (key === "p") {
          e.preventDefault();
          handlers.onOpenPdf();
          return;
        }
        if (key === "k") {
          e.preventDefault();
          handlers.onNewCanvas();
          return;
        }
      }

      if (
        e.altKey &&
        !mod &&
        !e.shiftKey &&
        key === "n" &&
        !isEditableElement(e.target)
      ) {
        e.preventDefault();
        handlers.onNewCanvas();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
