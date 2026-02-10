import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkdownFile } from './useMarkdownFile';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, remove } from '@tauri-apps/plugin-fs';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
}));

describe('useMarkdownFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(open).mockResolvedValue(null);
    vi.mocked(save).mockResolvedValue(null);
    vi.mocked(readTextFile).mockResolvedValue('');
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
    vi.mocked(remove).mockResolvedValue(undefined);
  });

  it('tracks dirty state and save/save-as flow', async () => {
    vi.mocked(save).mockResolvedValue('/tmp/note.md');

    const { result } = renderHook(() => useMarkdownFile());

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setMarkdown('hello');
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveFile();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/note.md', 'hello');
    expect(result.current.currentPath).toBe('/tmp/note.md');
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setMarkdown('hello world');
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveFile();
    });

    expect(writeTextFile).toHaveBeenLastCalledWith('/tmp/note.md', 'hello world');
    expect(result.current.isDirty).toBe(false);
  });

  it('opens a file and resets dirty state', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/open.md');
    vi.mocked(readTextFile).mockResolvedValue('# opened');

    const { result } = renderHook(() => useMarkdownFile());

    await act(async () => {
      await result.current.openFile();
    });

    expect(readTextFile).toHaveBeenCalledWith('/tmp/open.md');
    expect(result.current.markdown).toBe('# opened');
    expect(result.current.currentPath).toBe('/tmp/open.md');
    expect(result.current.isDirty).toBe(false);
  });

  it('opens an explicit path and resets dirty state', async () => {
    vi.mocked(readTextFile).mockResolvedValue('# startup');

    const { result } = renderHook(() => useMarkdownFile());

    await act(async () => {
      await result.current.openFileAtPath('/tmp/startup.md');
    });

    expect(readTextFile).toHaveBeenCalledWith('/tmp/startup.md');
    expect(result.current.markdown).toBe('# startup');
    expect(result.current.currentPath).toBe('/tmp/startup.md');
    expect(result.current.isDirty).toBe(false);
  });

  it('renames the current file path', async () => {
    vi.mocked(save).mockResolvedValue('/tmp/old.md');
    vi.mocked(readTextFile).mockResolvedValue('persisted');

    const { result } = renderHook(() => useMarkdownFile());

    act(() => {
      result.current.setMarkdown('persisted');
    });
    await act(async () => {
      await result.current.saveFile();
    });

    await act(async () => {
      await result.current.renameFile('/tmp/new.md');
    });

    expect(readTextFile).toHaveBeenCalledWith('/tmp/old.md');
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/new.md', 'persisted');
    expect(remove).toHaveBeenCalledWith('/tmp/old.md');
    expect(result.current.currentPath).toBe('/tmp/new.md');
  });
});
