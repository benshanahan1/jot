import { useCallback, useEffect, useRef, useState } from "react";
import "./fonts.css";
import "./App.css";
import "./editor.css";
import "./toast.css";
import { Editor } from "./components/Editor";
import { TabBar } from "./components/TabBar";
import { Toast } from "./components/Toast";
import { isDocumentDirty, useDocuments } from "./hooks/useDocuments";
import { useHotkeys } from "./hooks/useHotkeys";
import { usePreferences, useResolvedTheme } from "./hooks/usePreferences";
import { abbreviateHome, getFileName, getFileStem, isValidFileStem, replaceFileStem } from "./utils/path";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function App() {
  const isTauri = isTauriRuntime();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [homePath, setHomePath] = useState<string | null>(null);
  // Bumped after View menu clicks so check marks are re-synced even when nothing changed.
  const [viewMenuClicks, setViewMenuClicks] = useState(0);

  const { preferences, updatePreferences, zoomIn, zoomOut, resetZoom } = usePreferences();
  const resolvedTheme = useResolvedTheme(preferences.themeMode);

  const {
    documents,
    activeId,
    getDocument,
    getDocuments,
    getActiveId,
    editorRef,
    setMarkdown,
    hasUnsavedChanges,
    handleEditorReady,
    activate,
    activateRelative,
    activateIndex,
    newDocument,
    openPath,
    openFiles,
    saveDocument,
    saveDocumentAs,
    renameDocument,
    closeDocument,
  } = useDocuments();

  const activeDocument = documents.find((doc) => doc.id === activeId);
  const activePath = activeDocument?.path ?? null;
  const activeIsDirty = activeDocument ? isDocumentDirty(activeDocument) : false;

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now(), message: text });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  /** Runs a file action, reporting failures in a toast instead of rejecting. */
  const attempt = useCallback(async <T,>(failureLabel: string, action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      console.error(`${failureLabel}:`, error);
      showToast(`${failureLabel}: ${describeError(error)}`);
      return undefined;
    }
  }, [showToast]);

  /** Asks to save a document's unsaved changes. Resolves to true if it's safe to close. */
  const confirmClose = useCallback(async (id: number): Promise<boolean> => {
    if (!hasUnsavedChanges(id)) return true;

    activate(id);
    const path = getDocument(id)?.path;
    const name = path ? getFileName(path) : 'Untitled';

    if (!isTauri) return window.confirm(`Discard unsaved changes to ${name}?`);

    const choice = await message(`Do you want to save the changes you made to ${name}?`, {
      title: 'Unsaved changes',
      kind: 'warning',
      buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
    });

    if (choice === 'Save') return (await attempt("Couldn't save", () => saveDocument(id))) ?? false;
    return choice === "Don't Save";
  }, [activate, attempt, getDocument, hasUnsavedChanges, isTauri, saveDocument]);

  /** Asks about every unsaved document in turn. Resolves to false if the user cancels any. */
  const confirmCloseAll = useCallback(async (): Promise<boolean> => {
    for (const doc of getDocuments()) {
      if (!(await confirmClose(doc.id))) return false;
    }
    return true;
  }, [confirmClose, getDocuments]);

  const closeWindow = useCallback(() => {
    // Goes through onCloseRequested below, which checks for unsaved changes.
    void getCurrentWindow().close();
  }, []);

  const handleCloseTab = useCallback(async (id: number) => {
    // Closing the last tab closes the window (and quits), like a browser.
    if (isTauri && getDocuments().length === 1) {
      closeWindow();
      return;
    }
    if (await confirmClose(id)) closeDocument(id);
  }, [closeDocument, closeWindow, confirmClose, getDocuments, isTauri]);

  const handleOpen = useCallback(() => attempt("Couldn't open file", openFiles), [attempt, openFiles]);

  const handleSave = useCallback(
    () => attempt("Couldn't save", () => saveDocument(getActiveId())),
    [attempt, getActiveId, saveDocument],
  );

  const handleSaveAs = useCallback(
    () => attempt("Couldn't save", () => saveDocumentAs(getActiveId())),
    [attempt, getActiveId, saveDocumentAs],
  );

  const handleStartRename = useCallback((id: number) => {
    // An untitled document has nothing on disk to rename; naming it means saving it.
    if (getDocument(id)?.path) setRenamingId(id);
    else void attempt("Couldn't save", () => saveDocumentAs(id));
  }, [attempt, getDocument, saveDocumentAs]);

  const handleRename = useCallback(async (id: number, newStem: string) => {
    setRenamingId(null);
    const path = getDocument(id)?.path;
    const stem = newStem.trim();
    if (!path || !stem || stem === getFileStem(path)) return;

    if (!isValidFileStem(stem)) {
      showToast('File names can’t contain slashes');
      return;
    }

    const newPath = replaceFileStem(path, stem);
    await attempt("Couldn't rename", async () => {
      await renameDocument(id, newPath);
      showToast(`Renamed to ${getFileName(newPath)}`);
    });
  }, [attempt, getDocument, renameDocument, showToast]);

  const handleCancelRename = useCallback(() => setRenamingId(null), []);

  useHotkeys({
    onNextTab: () => activateRelative(1),
    onPreviousTab: () => activateRelative(-1),
    onSelectTab: activateIndex,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onZoomReset: resetZoom,
  });

  // Keyed by the menu item ids in src-tauri/src/lib.rs.
  const menuActions: Record<string, () => unknown> = {
    'app.quit': closeWindow,
    'file.new': newDocument,
    'file.open': handleOpen,
    'file.save': handleSave,
    'file.save_as': handleSaveAs,
    'file.rename': () => handleStartRename(getActiveId()),
    'file.close_tab': () => handleCloseTab(getActiveId()),
    'file.close_window': closeWindow,
    'view.theme.system': () => updatePreferences({ themeMode: 'system' }),
    'view.theme.light': () => updatePreferences({ themeMode: 'light' }),
    'view.theme.dark': () => updatePreferences({ themeMode: 'dark' }),
    'view.font.serif': () => updatePreferences({ fontFamily: 'serif' }),
    'view.font.sans': () => updatePreferences({ fontFamily: 'sans' }),
    'view.font.mono': () => updatePreferences({ fontFamily: 'mono' }),
    'view.wide': () => updatePreferences({
      widthMode: preferences.widthMode === 'wide' ? 'narrow' : 'wide',
    }),
    'view.zoom_in': zoomIn,
    'view.zoom_out': zoomOut,
    'view.zoom_reset': resetZoom,
    'window.next_tab': () => activateRelative(1),
    'window.previous_tab': () => activateRelative(-1),
    'help.docs': () => openUrl('https://ia.net/writer/how-to/quick-tour'),
  };

  // Native listeners are registered once and read the latest handlers through refs, so they
  // aren't torn down and re-registered (racily, since unlisten is async) on every keystroke.
  const menuActionsRef = useRef(menuActions);
  const confirmCloseAllRef = useRef(confirmCloseAll);
  useEffect(() => {
    menuActionsRef.current = menuActions;
    confirmCloseAllRef.current = confirmCloseAll;
  });

  useEffect(() => {
    if (!isTauri) return;

    const unlistenMenu = listen<string>('menu-action', (event) => {
      const id = event.payload;
      const actions = menuActionsRef.current;
      if (!Object.prototype.hasOwnProperty.call(actions, id)) return;

      void actions[id]();
      if (id.startsWith('view.')) setViewMenuClicks((count) => count + 1);
    });

    const unlistenClose = getCurrentWindow().onCloseRequested(async (event) => {
      let canClose = false;
      try {
        canClose = await confirmCloseAllRef.current();
      } catch (error) {
        console.error('Unsaved-changes check failed:', error);
      }
      if (!canClose) event.preventDefault();
    });

    return () => {
      void unlistenMenu.then((unlisten) => unlisten());
      void unlistenClose.then((unlisten) => unlisten());
    };
  }, [isTauri]);

  useEffect(() => {
    if (!isTauri) return;

    void homeDir().then(setHomePath, () => setHomePath(null));

    // Files to open arrive from argv, from a later `jot` invocation, or from Finder.
    const openPendingFiles = () => attempt("Couldn't open file", async () => {
      const paths = await invoke<string[]>('take_pending_files');
      for (const path of paths ?? []) await openPath(path);
    });

    // Listen before the first claim so a request arriving in between isn't missed.
    const unlistenPending = listen('pending-files', () => void openPendingFiles());
    void unlistenPending.then(openPendingFiles);

    return () => {
      void unlistenPending.then((unlisten) => unlisten());
    };
  }, [attempt, isTauri, openPath]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isTauri) return;

    // Match the native title bar to the app; null follows the system.
    const theme = preferences.themeMode === 'system' ? null : preferences.themeMode;
    getCurrentWindow().setTheme(theme).catch((error) => {
      console.error('Failed to set window theme:', error);
    });
  }, [isTauri, preferences.themeMode]);

  useEffect(() => {
    if (!isTauri) return;

    // Show the current theme, font, and width as check marks in the View menu.
    const checked = [
      `view.theme.${preferences.themeMode}`,
      `view.font.${preferences.fontFamily}`,
      ...(preferences.widthMode === 'wide' ? ['view.wide'] : []),
    ];
    invoke('sync_view_menu', { checked }).catch((error) => {
      console.error('Failed to update the View menu:', error);
    });
  }, [isTauri, preferences.themeMode, preferences.fontFamily, preferences.widthMode, viewMenuClicks]);

  useEffect(() => {
    const displayPath = activePath
      ? (homePath ? abbreviateHome(activePath, homePath) : activePath)
      : 'Untitled';
    const title = `${displayPath}${activeIsDirty ? ' *' : ''}`;

    document.title = title;
    if (isTauri) {
      getCurrentWindow().setTitle(title).catch((error) => {
        console.error('Failed to set window title:', error);
      });
    }
  }, [activePath, activeIsDirty, homePath, isTauri]);

  return (
    <div className="app-container">
      <TabBar
        documents={documents}
        activeId={activeId}
        renamingId={renamingId}
        onActivate={activate}
        onClose={(id) => void handleCloseTab(id)}
        onNew={newDocument}
        onStartRename={handleStartRename}
        onCancelRename={handleCancelRename}
        onRename={handleRename}
      />
      <div
        className={`editor-wrapper font-${preferences.fontFamily} width-${preferences.widthMode}`}
        style={{ '--editor-scale': String(preferences.textScale) } as React.CSSProperties}
      >
        {documents.map((doc) => (
          <Editor
            key={doc.id}
            ref={editorRef(doc.id)}
            initialValue={doc.markdown}
            onReady={(markdown) => handleEditorReady(doc.id, markdown)}
            onChange={(markdown) => setMarkdown(doc.id, markdown)}
            textScale={preferences.textScale}
            active={doc.id === activeId}
          />
        ))}
      </div>
      {toast && (
        <Toast key={toast.id} message={toast.message} onClose={dismissToast} />
      )}
    </div>
  );
}

export default App;
