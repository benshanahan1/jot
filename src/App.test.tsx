import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { useDocuments, type MarkdownDocument } from './hooks/useDocuments';

type MenuHandler = (event: { payload: string }) => void;
type CloseHandler = (event: { preventDefault: () => void }) => Promise<void>;

vi.mock('./components/Editor', () => ({
  Editor: ({ textScale, active }: { textScale: number; active: boolean }) =>
    active ? <div data-testid="editor" data-scale={String(textScale)} /> : null,
}));

vi.mock('./components/TabBar', () => ({
  TabBar: ({ documents }: { documents: { path: string | null }[] }) => (
    <div data-testid="tabs">{documents.map((doc) => doc.path ?? 'Untitled').join('|')}</div>
  ),
}));

vi.mock('./components/Toast', () => ({
  Toast: () => null,
}));

vi.mock('./hooks/useDocuments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks/useDocuments')>()),
  useDocuments: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn().mockResolvedValue('/Users/me'),
}));

const windowMock = {
  setTitle: vi.fn(),
  setTheme: vi.fn(),
  close: vi.fn(),
  onCloseRequested: vi.fn(),
};

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  message: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

describe('App', () => {
  let menuHandler: MenuHandler | null = null;
  let closeHandler: CloseHandler | null = null;
  let pendingFileHandler: (() => void) | null = null;
  let fileState: ReturnType<typeof useDocuments>;

  // Flushes the async startup effects (home dir, CLI path) so they settle inside act().
  const renderApp = async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<App />);
    });
    return view;
  };

  const sendMenuAction = async (payload: string) => {
    await act(async () => {
      menuHandler?.({ payload });
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    menuHandler = null;
    closeHandler = null;
    pendingFileHandler = null;

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    const doc: MarkdownDocument = {
      id: 1,
      path: '/tmp/note.md',
      markdown: '# note',
      savedMarkdown: '# note',
      frontMatter: '',
    };
    fileState = {
      documents: [doc],
      activeId: 1,
      getDocument: vi.fn().mockReturnValue(doc),
      getDocuments: vi.fn().mockReturnValue([doc]),
      getActiveId: vi.fn().mockReturnValue(1),
      editorRef: vi.fn().mockReturnValue(() => {}),
      setMarkdown: vi.fn(),
      hasUnsavedChanges: vi.fn().mockReturnValue(false),
      handleEditorReady: vi.fn(),
      activate: vi.fn(),
      activateRelative: vi.fn(),
      activateIndex: vi.fn(),
      newDocument: vi.fn(),
      openPath: vi.fn(),
      openFiles: vi.fn(),
      saveDocument: vi.fn().mockResolvedValue(true),
      saveDocumentAs: vi.fn().mockResolvedValue(true),
      renameDocument: vi.fn(),
      closeDocument: vi.fn(),
    };
    vi.mocked(useDocuments).mockImplementation(() => fileState);

    vi.mocked(invoke).mockResolvedValue(null);
    windowMock.setTitle.mockResolvedValue(undefined);
    windowMock.setTheme.mockResolvedValue(undefined);
    windowMock.onCloseRequested.mockImplementation(async (handler: CloseHandler) => {
      closeHandler = handler;
      return () => {};
    });

    vi.mocked(listen).mockImplementation(async (eventName, handler) => {
      if (eventName === 'menu-action') menuHandler = handler as MenuHandler;
      if (eventName === 'pending-files') pendingFileHandler = handler as () => void;
      return () => {};
    });
  });

  it('runs save when menu emits file.save', async () => {
    await renderApp();
    await sendMenuAction('file.save');
    expect(fileState.saveDocument).toHaveBeenCalledWith(1);
  });

  it('registers native listeners once, not on every render', async () => {
    const { rerender } = await renderApp();
    rerender(<App />);
    rerender(<App />);
    expect(listen).toHaveBeenCalledTimes(2);
    expect(listen).toHaveBeenCalledWith('pending-files', expect.any(Function));
    expect(windowMock.onCloseRequested).toHaveBeenCalledTimes(1);
  });

  it('clamps zoom scale from menu actions', async () => {
    await renderApp();

    for (let i = 0; i < 30; i += 1) await sendMenuAction('view.zoom_in');
    expect(screen.getByTestId('editor').getAttribute('data-scale')).toBe('2.2');

    for (let i = 0; i < 40; i += 1) await sendMenuAction('view.zoom_out');
    expect(screen.getByTestId('editor').getAttribute('data-scale')).toBe('0.6');
  });

  it('updates document theme attribute from menu actions', async () => {
    await renderApp();

    await sendMenuAction('view.theme.dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(windowMock.setTheme).toHaveBeenLastCalledWith('dark');

    await sendMenuAction('view.theme.light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists view preferences across launches', async () => {
    const { unmount } = await renderApp();
    await sendMenuAction('view.theme.dark');
    await sendMenuAction('view.zoom_in');
    unmount();

    document.documentElement.removeAttribute('data-theme');
    await renderApp();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByTestId('editor').getAttribute('data-scale')).toBe('1.25');
  });

  it('opens the file passed on the command line', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => (cmd === 'take_pending_files' ? ['/tmp/cli.md', '/tmp/b.md'] : undefined));
    await renderApp();
    expect(invoke).toHaveBeenCalledWith('take_pending_files');
    expect(vi.mocked(fileState.openPath).mock.calls).toEqual([['/tmp/cli.md'], ['/tmp/b.md']]);
  });

  it('opens files sent while running (second launch or Finder) as tabs', async () => {
    await renderApp();
    vi.mocked(invoke).mockImplementation(async (cmd) => (cmd === 'take_pending_files' ? ['/tmp/finder.md'] : undefined));

    await act(async () => {
      pendingFileHandler?.();
    });

    expect(message).not.toHaveBeenCalled();
    expect(fileState.openPath).toHaveBeenCalledWith('/tmp/finder.md');
  });

  it('checks the current view settings in the native menu', async () => {
    await renderApp();
    await sendMenuAction('view.font.mono');
    await sendMenuAction('view.wide');

    expect(invoke).toHaveBeenLastCalledWith('sync_view_menu', {
      checked: ['view.theme.system', 'view.font.mono', 'view.wide'],
    });
  });

  describe('with unsaved changes', () => {
    beforeEach(() => {
      vi.mocked(fileState.hasUnsavedChanges).mockReturnValue(true);
      // A second tab, so closing a tab doesn't close the window.
      const other: MarkdownDocument = { id: 2, path: null, markdown: '', savedMarkdown: '', frontMatter: '' };
      vi.mocked(fileState.getDocuments).mockReturnValue([...fileState.documents, other]);
    });

    it('keeps the tab open when the user cancels', async () => {
      vi.mocked(message).mockResolvedValue('Cancel');
      await renderApp();

      await sendMenuAction('file.close_tab');

      expect(message).toHaveBeenCalledTimes(1);
      expect(fileState.closeDocument).not.toHaveBeenCalled();
    });

    it("closes without saving on Don't Save", async () => {
      vi.mocked(message).mockResolvedValue("Don't Save");
      await renderApp();

      await sendMenuAction('file.close_tab');

      expect(fileState.saveDocument).not.toHaveBeenCalled();
      expect(fileState.closeDocument).toHaveBeenCalledWith(1);
    });

    it('saves before closing on Save, and stays open if the save is cancelled', async () => {
      vi.mocked(message).mockResolvedValue('Save');
      await renderApp();

      await sendMenuAction('file.close_tab');
      expect(fileState.saveDocument).toHaveBeenCalledWith(1);
      expect(fileState.closeDocument).toHaveBeenCalledTimes(1);

      vi.mocked(fileState.saveDocument).mockResolvedValue(false);
      await sendMenuAction('file.close_tab');
      expect(fileState.closeDocument).toHaveBeenCalledTimes(1);
    });

    it('blocks window close until the user decides', async () => {
      await renderApp();
      const preventDefault = vi.fn();

      vi.mocked(message).mockResolvedValue('Cancel');
      await act(() => closeHandler!({ preventDefault }));
      expect(preventDefault).toHaveBeenCalledTimes(1);

      vi.mocked(message).mockResolvedValue("Don't Save");
      await act(() => closeHandler!({ preventDefault }));
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });

    it('blocks window close if saving fails', async () => {
      vi.mocked(message).mockResolvedValue('Save');
      vi.mocked(fileState.saveDocument).mockRejectedValue(new Error('disk full'));
      await renderApp();
      const preventDefault = vi.fn();

      await act(() => closeHandler!({ preventDefault }));
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores menu ids it does not know', async () => {
    await renderApp();
    await sendMenuAction('constructor');
    await sendMenuAction('42');
  });

  it('closes the window when the last tab is closed', async () => {
    await renderApp();
    await sendMenuAction('file.close_tab');

    expect(windowMock.close).toHaveBeenCalledTimes(1);
    expect(fileState.closeDocument).not.toHaveBeenCalled();
  });

  it('routes quit through the close-requested check', async () => {
    await renderApp();
    await sendMenuAction('app.quit');
    expect(windowMock.close).toHaveBeenCalledTimes(1);
  });
});
