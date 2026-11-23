import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import {
  ArrowLeft,
  Copy,
  Database,
  FileDown,
  FilePlus2,
  FolderOpen,
  HardDrive,
  ImageDown,
  Link2Off,
  Loader2,
  RefreshCw,
  Save,
  Share2,
  UserCheck,
  UserPlus,
  Workflow,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../lib/api";
import { IS_CLOUD_ENABLED } from "../lib/config";
import { useAuth } from "../hooks/useAuth";
import { useHotkeys } from "../hooks/useHotkeys";
import { useWorkspace, type SharedSessionInfo } from "../hooks/useWorkspace";
import { exportSceneToPng } from "../lib/exportPng";
import type {
  ExcalidrawImperativeAPI,
  StorageMode,
  SyncStatus,
  Theme,
  ToastMessage,
  WorkspaceRecord,
  WorkspaceWithFiles,
} from "../types/workspace";
import { AuthModal } from "./AuthModal";
import { ConflictModal } from "./ConflictModal";
import { ExportPdfModal } from "./ExportPdfModal";
import { MermaidModal } from "./MermaidModal";
import { ShareModal } from "./ShareModal";
import { TopRightControls } from "./TopRightControls";
import { WorkspaceDrawer } from "./WorkspaceDrawer";

type ThemePref = Theme | "system";
const KEY_THEME_PREF = "draw_theme_pref";

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: true,
    clearCanvas: true,
    export: { saveFileToDisk: true },
    loadScene: true,
    saveAsImage: true,
    saveToActiveFile: false,
    toggleTheme: true,
  },
} as const;

const EXCALIDRAW_READONLY_UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: { saveFileToDisk: true },
    loadScene: false,
    saveAsImage: true,
    saveToActiveFile: false,
    toggleTheme: true,
  },
} as const;

function resolveTheme(pref: ThemePref): Theme {
  if (pref !== "system") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

interface ExcalidrawViewportProps {
  sessionKey: number;
  setExcalidrawAPI: (api: ExcalidrawImperativeAPI) => void;
  initialData: NonNullable<ReturnType<typeof useWorkspace>["initialData"]>;
  onSceneChange: ReturnType<typeof useWorkspace>["handleSceneChange"];
  resolvedTheme: Theme;
  workspaceTitle: string;
  storageMode: StorageMode;
  themePref: ThemePref;
  user: AuthUser | null;
  isShared: boolean;
  isReadOnly: boolean;
  onSelectTheme: (next: ThemePref) => void;
  onOpenDrawer: () => void;
  onNewCanvas: () => void;
  onForceSave: () => void;
  onQuickToggleStorage: () => void;
  onOpenShare: () => void;
  onRefreshShared: () => void;
  onForkShared: () => void;
  onExitShared: () => void;
  onExportPng: () => void;
  onOpenPdf: () => void;
  onOpenMermaid: () => void;
  onOpenAuth: () => void;
}

const ExcalidrawViewport = memo(function ExcalidrawViewport({
  sessionKey,
  setExcalidrawAPI,
  initialData,
  onSceneChange,
  resolvedTheme,
  workspaceTitle,
  storageMode,
  themePref,
  user,
  isShared,
  isReadOnly,
  onSelectTheme,
  onOpenDrawer,
  onNewCanvas,
  onForceSave,
  onQuickToggleStorage,
  onOpenShare,
  onRefreshShared,
  onForkShared,
  onExitShared,
  onExportPng,
  onOpenPdf,
  onOpenMermaid,
  onOpenAuth,
}: ExcalidrawViewportProps) {
  return (
    <Excalidraw
      key={sessionKey}
      excalidrawAPI={setExcalidrawAPI}
      initialData={initialData}
      onChange={onSceneChange}
      theme={resolvedTheme}
      name={workspaceTitle}
      viewModeEnabled={isReadOnly}
      UIOptions={
        isReadOnly ? EXCALIDRAW_READONLY_UI_OPTIONS : EXCALIDRAW_UI_OPTIONS
      }
    >
      <MainMenu>
        {isShared ? (
          <>
            <MainMenu.Item
              icon={<RefreshCw className="h-4 w-4" />}
              onSelect={onRefreshShared}
            >
              Muat Ulang dari Server
            </MainMenu.Item>
            {!isReadOnly && (
              <MainMenu.Item
                icon={<Save className="h-4 w-4" />}
                shortcut="⌘S"
                onSelect={onForceSave}
              >
                Simpan Perubahan
              </MainMenu.Item>
            )}
            <MainMenu.Item
              icon={<Copy className="h-4 w-4" />}
              onSelect={onForkShared}
            >
              Simpan Salinan ke My Canvas
            </MainMenu.Item>
            <MainMenu.Item
              icon={<ArrowLeft className="h-4 w-4" />}
              onSelect={onExitShared}
            >
              Keluar ke Kanvas Saya
            </MainMenu.Item>

            <MainMenu.Separator />

            {!isReadOnly && <MainMenu.DefaultItems.LoadScene />}
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Item
              icon={<ImageDown className="h-4 w-4" />}
              onSelect={onExportPng}
            >
              Export PNG Cepat
            </MainMenu.Item>
            <MainMenu.Item
              icon={<FileDown className="h-4 w-4" />}
              shortcut="⌘⇧P"
              onSelect={onOpenPdf}
            >
              Export PDF...
            </MainMenu.Item>

            <MainMenu.Separator />

            {!isReadOnly && (
              <MainMenu.Item
                icon={<Workflow className="h-4 w-4" />}
                shortcut="⌘⇧M"
                onSelect={onOpenMermaid}
              >
                Mermaid to Excalidraw...
              </MainMenu.Item>
            )}
            <MainMenu.DefaultItems.CommandPalette />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            {!isReadOnly && <MainMenu.DefaultItems.ClearCanvas />}

            <MainMenu.Separator />

            <MainMenu.DefaultItems.ToggleTheme
              allowSystemTheme
              theme={themePref}
              onSelect={onSelectTheme}
            />
            {!isReadOnly && <MainMenu.DefaultItems.ChangeCanvasBackground />}
          </>
        ) : (
          <>
            <MainMenu.Item
              icon={<FolderOpen className="h-4 w-4" />}
              shortcut="⌘⇧W"
              onSelect={onOpenDrawer}
            >
              My Canvas & Folder
            </MainMenu.Item>
            <MainMenu.Item
              icon={<FilePlus2 className="h-4 w-4" />}
              shortcut="Alt+N"
              onSelect={onNewCanvas}
            >
              New Canvas
            </MainMenu.Item>
            <MainMenu.Item
              icon={<Save className="h-4 w-4" />}
              shortcut="⌘S"
              onSelect={onForceSave}
            >
              Simpan Sekarang
            </MainMenu.Item>
            {IS_CLOUD_ENABLED && (
              <>
                <MainMenu.Item
                  icon={<Share2 className="h-4 w-4" />}
                  onSelect={onOpenShare}
                >
                  Bagikan Link (Share)...
                </MainMenu.Item>
                <MainMenu.Item
                  icon={
                    storageMode === "cloud" ? (
                      <HardDrive className="h-4 w-4" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )
                  }
                  onSelect={onQuickToggleStorage}
                >
                  {storageMode === "cloud"
                    ? "Kelola Penyimpanan (Database)"
                    : "Simpan Canvas ini ke Database"}
                </MainMenu.Item>
              </>
            )}

            <MainMenu.Separator />

            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Item
              icon={<ImageDown className="h-4 w-4" />}
              onSelect={onExportPng}
            >
              Export PNG Cepat
            </MainMenu.Item>
            <MainMenu.Item
              icon={<FileDown className="h-4 w-4" />}
              shortcut="⌘⇧P"
              onSelect={onOpenPdf}
            >
              Export PDF...
            </MainMenu.Item>

            <MainMenu.Separator />

            <MainMenu.Item
              icon={<Workflow className="h-4 w-4" />}
              shortcut="⌘⇧M"
              onSelect={onOpenMermaid}
            >
              Mermaid to Excalidraw...
            </MainMenu.Item>
            <MainMenu.DefaultItems.CommandPalette />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />

            <MainMenu.Separator />

            <MainMenu.DefaultItems.ToggleTheme
              allowSystemTheme
              theme={themePref}
              onSelect={onSelectTheme}
            />
            <MainMenu.DefaultItems.ChangeCanvasBackground />

            {IS_CLOUD_ENABLED && (
              <>
                <MainMenu.Separator />

                <MainMenu.Item
                  icon={
                    user ? (
                      <UserCheck className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )
                  }
                  onSelect={onOpenAuth}
                >
                  {user
                    ? `Akun Database: ${user.username}`
                    : "Masuk Akun Database..."}
                </MainMenu.Item>
              </>
            )}
          </>
        )}
      </MainMenu>

      {!isShared && (
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.HelpHint />
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>
              Mulai Gambar Workflow Anda
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItem
                icon={<FolderOpen className="h-4 w-4" />}
                onSelect={onOpenDrawer}
              >
                Buka My Canvas
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItem
                icon={<Workflow className="h-4 w-4" />}
                onSelect={onOpenMermaid}
              >
                Generate dari Mermaid
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItemLoadScene />
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      )}
    </Excalidraw>
  );
});

interface FloatingTopControlsProps {
  workspace: WorkspaceWithFiles;
  syncStatus: SyncStatus;
  isOnline: boolean;
  theme: Theme;
  exportingPng: boolean;
  sharedSession: SharedSessionInfo | null;
  onRename: (newTitle: string) => Promise<void>;
  onOpenDrawer: () => void;
  onExportPng: () => void;
  onOpenPdf: () => void;
  onQuickToggleStorage: () => void;
  onOpenShare: () => void;
  onRefreshShared: () => void;
  onForkShared: () => void;
  onExitShared: () => void;
}

function FloatingTopControls(props: FloatingTopControlsProps) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-10">
      <TopRightControls {...props} />
    </div>
  );
}

export function CanvasBoard() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastSeqRef = useRef(0);

  const notify = useCallback(
    (text: string, tone: ToastMessage["tone"] = "info") => {
      const id = ++toastSeqRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    [],
  );

  const auth = useAuth();
  const ws = useWorkspace({
    isAuthenticated: auth.isAuthenticated,
    onNotify: notify,
  });

  const [themePref, setThemePref] = useState<ThemePref>(() => {
    const saved = localStorage.getItem(KEY_THEME_PREF);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "light";
  });
  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() =>
    resolveTheme(themePref),
  );

  useEffect(() => {
    const update = () => setResolvedTheme(resolveTheme(themePref));
    update();
    if (themePref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [themePref]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const handleSelectTheme = useCallback((next: ThemePref) => {
    setThemePref(next);
    localStorage.setItem(KEY_THEME_PREF, next);
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<WorkspaceRecord | null>(null);
  const [pendingMoveToDbId, setPendingMoveToDbId] = useState<string | null>(
    null,
  );

  const isShared = Boolean(ws.sharedSession);
  const isReadOnly = ws.sharedSession?.permission === "readonly";

  const openDrawer = useCallback(() => {
    if (isShared) return;
    void ws.prepareDrawerOpen();
    setDrawerOpen(true);
  }, [isShared, ws.prepareDrawerOpen]);

  const openMermaid = useCallback(() => {
    if (isReadOnly) return;
    setMermaidOpen(true);
  }, [isReadOnly]);
  const openPdf = useCallback(() => setPdfOpen(true), []);
  const openAuth = useCallback(() => {
    if (!IS_CLOUD_ENABLED) return;
    setAuthOpen(true);
  }, []);
  const openShareActive = useCallback(() => {
    if (!IS_CLOUD_ENABLED || isShared || !ws.activeWorkspace) return;
    setShareTarget(ws.activeWorkspace);
  }, [isShared, ws.activeWorkspace]);

  const handleExportPng = useCallback(async () => {
    const api = ws.apiRef.current;
    if (!api) {
      notify("Kanvas belum siap untuk diexport.", "warning");
      return;
    }
    setExportingPng(true);
    try {
      const filename = await exportSceneToPng({
        elements: api.getSceneElements(),
        files: api.getFiles(),
        viewBackgroundColor: api.getAppState().viewBackgroundColor || "#ffffff",
        darkMode: resolvedTheme === "dark",
        filename: ws.activeWorkspace?.title || "drawing",
      });
      notify(`Berhasil export ${filename}`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal export PNG.", "error");
    } finally {
      setExportingPng(false);
    }
  }, [notify, resolvedTheme, ws.activeWorkspace?.title, ws.apiRef]);

  const handleExportPngSync = useCallback(() => {
    void handleExportPng();
  }, [handleExportPng]);

  const handleNewCanvas = useCallback(() => {
    if (isShared) return;
    void ws.createNewCanvas();
  }, [isShared, ws.createNewCanvas]);

  const handleForceSave = useCallback(() => {
    void ws.forceSave();
  }, [ws.forceSave]);

  const handleToggleDrawerHotkey = useCallback(() => {
    if (isShared) return;
    setDrawerOpen((prev) => {
      if (!prev) void ws.prepareDrawerOpen();
      return !prev;
    });
  }, [isShared, ws.prepareDrawerOpen]);

  const handleRefreshSharedSync = useCallback(() => {
    void ws.refreshSharedWorkspace();
  }, [ws.refreshSharedWorkspace]);

  const handleForkSharedSync = useCallback(() => {
    void ws.forkSharedToLocal();
  }, [ws.forkSharedToLocal]);

  const handleExitSharedSync = useCallback(() => {
    void ws.exitSharedSession();
  }, [ws.exitSharedSession]);

  const handleConfigureShare = useCallback(
    async (id: string, config: Parameters<typeof ws.configureShare>[1]) => {
      const updated = await ws.configureShare(id, config);
      setShareTarget(updated);
      return updated;
    },
    [ws.configureShare],
  );

  useHotkeys({
    onForceSave: handleForceSave,
    onToggleDrawer: handleToggleDrawerHotkey,
    onOpenMermaid: openMermaid,
    onOpenPdf: openPdf,
    onNewCanvas: handleNewCanvas,
  });

  const activeId = ws.activeWorkspace?.id ?? null;
  const activeStorageMode = ws.activeWorkspace?.storageMode ?? "local";
  const moveToDatabase = ws.moveToDatabase;
  const syncAllFromCloud = ws.syncAllFromCloud;

  const handleQuickToggleStorage = useCallback(async () => {
    if (!IS_CLOUD_ENABLED || !activeId) return;

    if (activeStorageMode === "local") {
      if (!auth.isAuthenticated) {
        setPendingMoveToDbId(activeId);
        setAuthOpen(true);
        return;
      }
      try {
        await moveToDatabase(activeId);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Gagal menyimpan ke Database.",
          "error",
        );
      }
    } else {
      openDrawer();
    }
  }, [
    activeId,
    activeStorageMode,
    auth.isAuthenticated,
    moveToDatabase,
    notify,
    openDrawer,
  ]);

  const handleQuickToggleStorageSync = useCallback(() => {
    void handleQuickToggleStorage();
  }, [handleQuickToggleStorage]);

  const handleAuthenticated = useCallback(async () => {
    if (pendingMoveToDbId) {
      const targetId = pendingMoveToDbId;
      setPendingMoveToDbId(null);
      try {
        await moveToDatabase(targetId);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Gagal memindahkan ke Database.",
          "error",
        );
      }
    }
    await syncAllFromCloud(true);
  }, [moveToDatabase, notify, pendingMoveToDbId, syncAllFromCloud]);

  if (ws.sharedError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-white p-6 text-center text-[#1b1b1f] dark:bg-[#121212] dark:text-[#e3e3e8]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
          <Link2Off className="h-6 w-6" />
        </div>
        <h1 className="text-base font-semibold">Link Preview Tidak Tersedia</h1>
        <p className="max-w-sm text-xs leading-relaxed text-[#6b7280] dark:text-[#9b9b9f]">
          {ws.sharedError}
        </p>
        <button
          type="button"
          onClick={handleExitSharedSync}
          className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#6965db] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#5b57d1]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Kanvas Saya
        </button>
      </div>
    );
  }

  if (ws.isLoadingShared || !ws.initialData || !ws.activeWorkspace) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2.5 bg-white text-[#6b7280] dark:bg-[#121212] dark:text-[#9b9b9f]">
        <Loader2 className="h-6 w-6 animate-spin text-[#6965db]" />
        <p className="text-xs font-medium">
          {ws.isLoadingShared
            ? "Memuat kanvas preview..."
            : "Menyiapkan kanvas..."}
        </p>
      </div>
    );
  }

  return (
    <div className="excalidraw-wrapper">
      <ExcalidrawViewport
        sessionKey={ws.sessionKey}
        setExcalidrawAPI={ws.setExcalidrawAPI}
        initialData={ws.initialData}
        onSceneChange={ws.handleSceneChange}
        resolvedTheme={resolvedTheme}
        workspaceTitle={ws.activeWorkspace.title}
        storageMode={ws.activeWorkspace.storageMode}
        themePref={themePref}
        user={auth.user}
        isShared={isShared}
        isReadOnly={isReadOnly}
        onSelectTheme={handleSelectTheme}
        onOpenDrawer={openDrawer}
        onNewCanvas={handleNewCanvas}
        onForceSave={handleForceSave}
        onQuickToggleStorage={handleQuickToggleStorageSync}
        onOpenShare={openShareActive}
        onRefreshShared={handleRefreshSharedSync}
        onForkShared={handleForkSharedSync}
        onExitShared={handleExitSharedSync}
        onExportPng={handleExportPngSync}
        onOpenPdf={openPdf}
        onOpenMermaid={openMermaid}
        onOpenAuth={openAuth}
      />

      <FloatingTopControls
        workspace={ws.activeWorkspace}
        syncStatus={ws.syncStatus}
        isOnline={ws.isOnline}
        theme={resolvedTheme}
        exportingPng={exportingPng}
        sharedSession={ws.sharedSession}
        onRename={ws.renameActiveWorkspace}
        onOpenDrawer={openDrawer}
        onExportPng={handleExportPngSync}
        onOpenPdf={openPdf}
        onQuickToggleStorage={handleQuickToggleStorageSync}
        onOpenShare={openShareActive}
        onRefreshShared={handleRefreshSharedSync}
        onForkShared={handleForkSharedSync}
        onExitShared={handleExitSharedSync}
      />

      {drawerOpen && !isShared && (
        <WorkspaceDrawer
          open
          activeWorkspaceId={ws.activeWorkspace.id}
          user={auth.user}
          onClose={() => setDrawerOpen(false)}
          onSelectWorkspace={ws.switchWorkspace}
          onCreateCanvas={ws.createNewCanvas}
          onRenameWorkspace={ws.renameAnyWorkspace}
          onMoveFolder={ws.moveWorkspaceFolder}
          onDuplicateWorkspace={ws.duplicateAnyWorkspace}
          onDeleteWorkspace={ws.deleteAnyWorkspace}
          onMoveToDatabase={ws.moveToDatabase}
          onMoveToLocal={ws.moveToLocal}
          onShareWorkspace={(target) => setShareTarget(target)}
          onImportFile={ws.importExcalidrawFile}
          onSyncCloud={() => ws.syncAllFromCloud(false)}
          onOpenAuth={openAuth}
          onNotify={notify}
        />
      )}

      {IS_CLOUD_ENABLED && shareTarget && !isShared && (
        <ShareModal
          open
          workspace={shareTarget}
          user={auth.user}
          onClose={() => setShareTarget(null)}
          onConfigureShare={handleConfigureShare}
          onOpenAuth={openAuth}
          onNotify={notify}
        />
      )}

      {mermaidOpen && (
        <MermaidModal
          open
          theme={resolvedTheme}
          excalidrawAPI={ws.apiRef.current}
          onClose={() => setMermaidOpen(false)}
          onNotify={notify}
        />
      )}

      {pdfOpen && (
        <ExportPdfModal
          open
          workspaceTitle={ws.activeWorkspace.title}
          theme={resolvedTheme}
          excalidrawAPI={ws.apiRef.current}
          onClose={() => setPdfOpen(false)}
          onNotify={notify}
        />
      )}

      {IS_CLOUD_ENABLED && authOpen && (
        <AuthModal
          open
          user={auth.user}
          onClose={() => {
            setAuthOpen(false);
            setPendingMoveToDbId(null);
          }}
          onLogin={auth.login}
          onRegister={auth.register}
          onLogout={auth.logout}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {IS_CLOUD_ENABLED && ws.conflict && (
        <ConflictModal
          conflict={ws.conflict}
          onResolve={ws.resolveConflict}
          onDismiss={ws.dismissConflict}
        />
      )}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
        >
          {toasts.map((t) => {
            const toneStyles =
              t.tone === "success"
                ? "border-[#e5e7eb] bg-[#1b1b1f] text-white dark:border-[#31303b] dark:bg-[#232329]"
                : t.tone === "warning"
                  ? "border-amber-300 bg-amber-500 text-black"
                  : t.tone === "error"
                    ? "border-red-300 bg-red-600 text-white"
                    : "border-[#e5e7eb] bg-[#1b1b1f] text-white dark:border-[#31303b] dark:bg-[#232329]";
            return (
              <div
                key={t.id}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg ${toneStyles}`}
              >
                {t.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
