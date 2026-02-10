import { useCallback, useEffect, useState } from "react";
import "./App.css";
import "./editor.css";
import "./tooltip.css";
import "./toast.css";
import { Editor } from "./components/Editor";
import { EditorToolbar } from "./components/EditorToolbar";
import { Toast } from "./components/Toast";
import { useMarkdownFile } from "./hooks/useMarkdownFile";
import { useHotkeys } from "./hooks/useHotkeys";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type FontFamily = 'serif' | 'sans' | 'mono';
export type WidthMode = 'wide' | 'narrow';
export type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';
const MIN_TEXT_SCALE = 0.6;
const MAX_TEXT_SCALE = 2.2;
const TEXT_SCALE_STEP = 0.1;
const DEFAULT_TEXT_SCALE = 1.15;

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [widthMode, setWidthMode] = useState<WidthMode>('narrow');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(getSystemTheme);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [textScale, setTextScale] = useState(DEFAULT_TEXT_SCALE);
  const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  const {
    markdown,
    setMarkdown,
    currentPath,
    isDirty,
    fileVersion,
    openFile,
    openFileAtPath,
    saveFile,
    saveFileAs,
    newFile,
    renameFile,
  } = useMarkdownFile();

  const handleNewFile = useCallback(() => {
    // No need to check isDirty for now - we'll implement that later
    newFile();
  }, [newFile]);

  const handleOpenFile = useCallback(async () => {
    // No need to check isDirty for now - we'll implement that later
    await openFile();
  }, [openFile]);

  const handleSave = useCallback(async () => {
    await saveFile();
  }, [saveFile]);

  const handleSaveAs = useCallback(async () => {
    await saveFileAs();
  }, [saveFileAs]);

  const handleRename = useCallback(async (newPath: string) => {
    try {
      await renameFile(newPath);
      const fileName = newPath.split(/[\\/]/).pop();
      setToastMessage(`Renamed to ${fileName}`);
    } catch (error) {
      setToastMessage(`Failed to rename: ${error}`);
    }
  }, [renameFile]);

  const handleRenameFromMenu = useCallback(async () => {
    if (!currentPath) return;

    const pathParts = currentPath.split(/[\\/]/);
    const fullName = pathParts[pathParts.length - 1];
    const lastDot = fullName.lastIndexOf('.');
    const currentName = lastDot > 0 ? fullName.substring(0, lastDot) : fullName;
    const extension = lastDot > 0 ? fullName.substring(lastDot) : '';

    const nextName = window.prompt('Rename file', currentName);
    if (!nextName) return;

    const trimmed = nextName.trim();
    if (!trimmed || trimmed === currentName) return;

    pathParts[pathParts.length - 1] = `${trimmed}${extension}`;
    await handleRename(pathParts.join('/'));
  }, [currentPath, handleRename]);

  const handleZoomIn = useCallback(() => {
    setTextScale((current) => Math.min(MAX_TEXT_SCALE, Number((current + TEXT_SCALE_STEP).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTextScale((current) => Math.max(MIN_TEXT_SCALE, Number((current - TEXT_SCALE_STEP).toFixed(2))));
  }, []);

  const handleZoomReset = useCallback(() => {
    setTextScale(DEFAULT_TEXT_SCALE);
  }, []);

  useHotkeys({
    onNew: handleNewFile,
    onOpen: handleOpenFile,
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    enabled: true,
    enableFileShortcuts: !isTauriRuntime,
    enableZoomShortcuts: true,
  });

  useEffect(() => {
    if (!isTauriRuntime) return;

    const unlistenPromise = listen<string>('menu-action', async (event) => {
      switch (event.payload) {
        case 'file.new':
          handleNewFile();
          break;
        case 'file.open':
          await handleOpenFile();
          break;
        case 'file.save':
          await handleSave();
          break;
        case 'file.save_as':
          await handleSaveAs();
          break;
        case 'file.rename':
          await handleRenameFromMenu();
          break;
        case 'view.width.narrow':
          setWidthMode('narrow');
          break;
        case 'view.width.wide':
          setWidthMode('wide');
          break;
        case 'view.zoom_in':
          handleZoomIn();
          break;
        case 'view.zoom_out':
          handleZoomOut();
          break;
        case 'view.zoom_reset':
          handleZoomReset();
          break;
        case 'view.theme.system':
          setThemeMode('system');
          break;
        case 'view.theme.light':
          setThemeMode('light');
          break;
        case 'view.theme.dark':
          setThemeMode('dark');
          break;
        case 'view.font.serif':
          setFontFamily('serif');
          break;
        case 'view.font.sans':
          setFontFamily('sans');
          break;
        case 'view.font.mono':
          setFontFamily('mono');
          break;
        case 'help.docs':
          await openUrl('https://ia.net/writer/how-to/quick-tour');
          break;
        default:
          break;
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [
    handleNewFile,
    handleOpenFile,
    handleSave,
    handleSaveAs,
    handleRenameFromMenu,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    isTauriRuntime,
  ]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    const openStartupFile = async () => {
      try {
        const startupPath = await invoke<string | null>('startup_file_path');
        if (startupPath) {
          await openFileAtPath(startupPath);
        }
      } catch (error) {
        console.error('Failed to load startup file path:', error);
      }
    };

    void openStartupFile();
  }, [isTauriRuntime, openFileAtPath]);

  useEffect(() => {
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (event: MediaQueryListEvent) => {
        setResolvedTheme(event.matches ? 'dark' : 'light');
      };

      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    setResolvedTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Update window title
  useEffect(() => {
    const updateTitle = async () => {
      let displayPath = 'Untitled';
      if (currentPath) {
        try {
          const home = await homeDir();
          if (currentPath.startsWith(home)) {
            displayPath = '~' + currentPath.slice(home.length);
          } else {
            displayPath = currentPath;
          }
        } catch {
          // Fallback to full path if homeDir() fails
          displayPath = currentPath;
        }
      }
      const title = `${displayPath}${isDirty ? ' *' : ''} · jot`;

      // Set title for both web and Tauri
      document.title = title;
      if (isTauriRuntime) {
        try {
          await getCurrentWindow().setTitle(title);
        } catch (error) {
          console.error('Failed to set window title:', error);
        }
      }
    };

    void updateTitle();
  }, [currentPath, isDirty, isTauriRuntime]);

  return (
    <div className="app-container">
      <EditorToolbar
        currentFilePath={currentPath}
        hasUnsavedChanges={isDirty}
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onSave={handleSave}
        onRename={handleRename}
      />
      <div
        className={`editor-wrapper font-${fontFamily} width-${widthMode}`}
        style={{ '--editor-scale': String(textScale) } as Record<string, string>}
      >
        <Editor
          key={fileVersion}
          value={markdown}
          onChange={setMarkdown}
          textScale={textScale}
        />
      </div>
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}

export default App;
