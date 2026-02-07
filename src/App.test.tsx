import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import App from './App';
import { listen } from '@tauri-apps/api/event';
import { useMarkdownFile } from './hooks/useMarkdownFile';

type MenuActionEvent = { payload: string };
type MenuHandler = (event: MenuActionEvent) => void | Promise<void>;

const editorMock = vi.fn(
  ({ textScale }: { textScale: number }): ReactElement => (
    <div data-testid="editor" data-scale={String(textScale)} />
  ),
);

vi.mock('./components/Editor', () => ({
  Editor: (props: { textScale: number }) => editorMock(props),
}));

vi.mock('./components/EditorToolbar', () => ({
  EditorToolbar: () => <div data-testid="toolbar" />,
}));

vi.mock('./components/Toast', () => ({
  Toast: () => null,
}));

vi.mock('./hooks/useMarkdownFile', () => ({
  useMarkdownFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

describe('App critical flows', () => {
  let menuHandler: MenuHandler | null = null;
  const saveFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    menuHandler = null;

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

    vi.mocked(useMarkdownFile).mockReturnValue({
      markdown: '# note',
      setMarkdown: vi.fn(),
      currentPath: '/tmp/note.md',
      isDirty: false,
      fileVersion: 1,
      openFile: vi.fn(),
      saveFile,
      saveFileAs: vi.fn(),
      newFile: vi.fn(),
      renameFile: vi.fn(),
    });

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      menuHandler = handler as MenuHandler;
      return () => {};
    });
  });

  it('runs save when menu emits file.save', async () => {
    render(<App />);
    expect(menuHandler).not.toBeNull();

    await act(async () => {
      await menuHandler?.({ payload: 'file.save' });
    });

    expect(saveFile).toHaveBeenCalledTimes(1);
  });

  it('clamps zoom scale from menu actions', async () => {
    render(<App />);

    await act(async () => {
      for (let i = 0; i < 30; i += 1) {
        await menuHandler?.({ payload: 'view.zoom_in' });
      }
    });
    expect(screen.getByTestId('editor').getAttribute('data-scale')).toBe('2.2');

    await act(async () => {
      for (let i = 0; i < 40; i += 1) {
        await menuHandler?.({ payload: 'view.zoom_out' });
      }
    });
    expect(screen.getByTestId('editor').getAttribute('data-scale')).toBe('0.6');
  });

  it('updates document theme attribute from menu actions', async () => {
    render(<App />);

    await act(async () => {
      await menuHandler?.({ payload: 'view.theme.dark' });
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await act(async () => {
      await menuHandler?.({ payload: 'view.theme.light' });
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
