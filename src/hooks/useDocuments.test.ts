import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isDocumentDirty, useDocuments } from './useDocuments';
import type { EditorHandle } from '../components/Editor';
import { open, save } from '@tauri-apps/plugin-dialog';
import { exists, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  rename: vi.fn(),
  writeTextFile: vi.fn(),
}));

type Hook = ReturnType<typeof useDocuments>;

const active = (hook: Hook) => hook.documents.find((doc) => doc.id === hook.activeId)!;

describe('useDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(open).mockResolvedValue(null);
    vi.mocked(save).mockResolvedValue(null);
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readTextFile).mockImplementation(async (path) => `# ${path}`);
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
    vi.mocked(rename).mockResolvedValue(undefined);
  });

  function setup() {
    return renderHook(() => useDocuments());
  }

  async function openAt(result: { current: Hook }, path: string) {
    await act(() => result.current.openPath(path));
    return result.current.activeId;
  }

  it('starts with one empty Untitled tab', () => {
    const { result } = setup();
    expect(result.current.documents).toHaveLength(1);
    expect(active(result.current)).toMatchObject({ path: null, markdown: '' });
  });

  it('opens files into the launch tab, then into new tabs, and reuses already-open files', async () => {
    const { result } = setup();

    await openAt(result, '/tmp/a.md');
    expect(result.current.documents).toHaveLength(1);

    const bId = await openAt(result, '/tmp/b.md');
    expect(result.current.documents.map((doc) => doc.path)).toEqual(['/tmp/a.md', '/tmp/b.md']);

    await openAt(result, '/tmp/a.md');
    expect(result.current.documents).toHaveLength(2);
    expect(active(result.current).path).toBe('/tmp/a.md');
    expect(readTextFile).toHaveBeenCalledTimes(2);

    act(() => result.current.activate(bId));
    expect(active(result.current).path).toBe('/tmp/b.md');
  });

  it('opens every file picked in the dialog', async () => {
    vi.mocked(open).mockResolvedValue(['/tmp/a.md', '/tmp/b.md'] as never);
    const { result } = setup();

    await act(() => result.current.openFiles());

    expect(result.current.documents.map((doc) => doc.path)).toEqual(['/tmp/a.md', '/tmp/b.md']);
  });

  it('starts an empty document at a path that does not exist yet', async () => {
    vi.mocked(exists).mockResolvedValue(false);
    const { result } = setup();

    await openAt(result, '/tmp/new.md');

    expect(readTextFile).not.toHaveBeenCalled();
    expect(active(result.current)).toMatchObject({ path: '/tmp/new.md', markdown: '' });
  });

  it('tracks dirty state per tab and saves the right one', async () => {
    const { result } = setup();
    const aId = await openAt(result, '/tmp/a.md');
    const bId = await openAt(result, '/tmp/b.md');

    act(() => result.current.setMarkdown(aId, 'edited a'));
    expect(isDocumentDirty(result.current.getDocument(aId)!)).toBe(true);
    expect(isDocumentDirty(result.current.getDocument(bId)!)).toBe(false);

    await act(() => result.current.saveDocument(aId));
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/a.md', 'edited a');
    expect(isDocumentDirty(result.current.getDocument(aId)!)).toBe(false);
  });

  it('saves untitled documents through the dialog and reports cancellation', async () => {
    const { result } = setup();
    const id = result.current.activeId;
    act(() => result.current.setMarkdown(id, 'draft'));

    await act(async () => {
      expect(await result.current.saveDocument(id)).toBe(false);
    });
    expect(writeTextFile).not.toHaveBeenCalled();

    vi.mocked(save).mockResolvedValue('/tmp/draft.md');
    await act(async () => {
      expect(await result.current.saveDocument(id)).toBe(true);
    });
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/draft.md', 'draft');
    expect(result.current.getDocument(id)).toMatchObject({ path: '/tmp/draft.md' });
    // Same document, so the editor (and its undo history) is kept.
    expect(result.current.activeId).toBe(id);
  });

  it('propagates write failures and stays dirty', async () => {
    vi.mocked(writeTextFile).mockRejectedValue(new Error('disk full'));
    const { result } = setup();
    const id = await openAt(result, '/tmp/a.md');
    act(() => result.current.setMarkdown(id, 'draft'));

    await act(async () => {
      await expect(result.current.saveDocument(id)).rejects.toThrow('disk full');
    });
    expect(isDocumentDirty(result.current.getDocument(id)!)).toBe(true);
  });

  it('saves the live editor content rather than the debounced onChange value', async () => {
    const { result } = setup();
    const id = await openAt(result, '/tmp/a.md');
    act(() => {
      result.current.editorRef(id)({ getMarkdown: () => 'typed just now' } as EditorHandle);
      result.current.setMarkdown(id, 'typed a moment ago');
    });

    act(() => {
      expect(result.current.hasUnsavedChanges(id)).toBe(true);
    });
    await act(() => result.current.saveDocument(id));

    expect(writeTextFile).toHaveBeenCalledWith('/tmp/a.md', 'typed just now');
    act(() => {
      expect(result.current.hasUnsavedChanges(id)).toBe(false);
    });
  });

  it("treats the editor's normalized form of a freshly loaded file as clean", async () => {
    vi.mocked(readTextFile).mockResolvedValue('* item');
    const { result } = setup();
    const id = await openAt(result, '/tmp/list.md');

    act(() => result.current.handleEditorReady(id, '- item\n'));

    expect(result.current.getDocument(id)).toMatchObject({ markdown: '- item\n', savedContent: '- item\n' });
  });

  it('keeps front matter out of the editor and writes it back on save', async () => {
    vi.mocked(readTextFile).mockResolvedValue('---\ntitle: Post\n---\n# Body\n');
    const { result } = setup();
    const id = await openAt(result, '/tmp/post.md');
    expect(active(result.current).markdown).toBe('# Body\n');

    act(() => result.current.setMarkdown(id, '# Edited\n'));
    await act(() => result.current.saveDocument(id));

    expect(writeTextFile).toHaveBeenCalledWith('/tmp/post.md', '---\ntitle: Post\n---\n# Edited\n');
  });

  it('cycles and selects tabs', async () => {
    const { result } = setup();
    const aId = await openAt(result, '/tmp/a.md');
    const bId = await openAt(result, '/tmp/b.md');
    const cId = await openAt(result, '/tmp/c.md');

    act(() => result.current.activateRelative(1));
    expect(result.current.activeId).toBe(aId);
    act(() => result.current.activateRelative(-1));
    expect(result.current.activeId).toBe(cId);
    act(() => result.current.activateIndex(1));
    expect(result.current.activeId).toBe(bId);
    act(() => result.current.activateIndex(-1));
    expect(result.current.activeId).toBe(cId);
    act(() => result.current.activateIndex(7));
    expect(result.current.activeId).toBe(cId);
  });

  it('closes tabs, activating a neighbour and never leaving zero tabs', async () => {
    const { result } = setup();
    const aId = await openAt(result, '/tmp/a.md');
    const bId = await openAt(result, '/tmp/b.md');

    act(() => result.current.closeDocument(bId));
    expect(result.current.activeId).toBe(aId);

    act(() => result.current.closeDocument(aId));
    expect(result.current.documents).toHaveLength(1);
    expect(active(result.current)).toMatchObject({ path: null, markdown: '' });
  });

  it('renames in place, refusing to overwrite but allowing case-only changes', async () => {
    const { result } = setup();
    const id = await openAt(result, '/tmp/notes.md');

    await act(async () => {
      await expect(result.current.renameDocument(id, '/tmp/taken.md')).rejects.toThrow('taken.md already exists');
    });
    expect(rename).not.toHaveBeenCalled();

    await act(() => result.current.renameDocument(id, '/tmp/Notes.md'));
    expect(rename).toHaveBeenCalledWith('/tmp/notes.md', '/tmp/Notes.md');

    vi.mocked(exists).mockResolvedValue(false);
    await act(() => result.current.renameDocument(id, '/tmp/ideas.md'));
    expect(result.current.getDocument(id)?.path).toBe('/tmp/ideas.md');
  });
});
