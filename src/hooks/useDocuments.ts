import { useCallback, useRef, useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { exists, readTextFile, rename, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import type { EditorHandle } from '../components/Editor';
import { splitFrontMatter } from '../utils/frontMatter';
import { getFileName } from '../utils/path';

const FILE_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }];

export interface MarkdownDocument {
  id: number;
  path: string | null;
  /** The body shown in the editor. Front matter is kept aside and re-attached on save. */
  markdown: string;
  savedMarkdown: string;
  frontMatter: string;
}

interface DocumentsState {
  documents: MarkdownDocument[];
  activeId: number;
}

export const isDocumentDirty = (doc: MarkdownDocument) => doc.markdown !== doc.savedMarkdown;

const isPristine = (doc: MarkdownDocument) =>
  doc.path === null && doc.markdown === '' && !isDocumentDirty(doc);

let nextDocumentId = 1;

function createDocument(path: string | null, content: string): MarkdownDocument {
  const [frontMatter, body] = splitFrontMatter(content);
  return { id: nextDocumentId++, path, markdown: body, savedMarkdown: body, frontMatter };
}

/** True if both paths name the same file, e.g. `notes.md` and `Notes.md` on a case-insensitive disk. */
async function isSameFile(a: string, b: string): Promise<boolean> {
  const [infoA, infoB] = await Promise.all([stat(a), stat(b)]);
  if (infoA.ino === null || infoB.ino === null) {
    // No inode numbers (Windows), whose filesystems are case-insensitive.
    return a.toLowerCase() === b.toLowerCase();
  }
  return infoA.dev === infoB.dev && infoA.ino === infoB.ino;
}

function initialState(): DocumentsState {
  const doc = createDocument(null, '');
  return { documents: [doc], activeId: doc.id };
}

/**
 * The open documents (one per tab) and the file operations on them.
 * File operations throw on failure so callers can decide how to report errors.
 */
export function useDocuments() {
  const [state, setRenderedState] = useState(initialState);
  // Async callbacks read the latest state from here rather than from a stale render.
  const stateRef = useRef(state);

  const setState = useCallback((update: (current: DocumentsState) => DocumentsState) => {
    stateRef.current = update(stateRef.current);
    setRenderedState(stateRef.current);
  }, []);

  const getDocument = useCallback(
    (id: number) => stateRef.current.documents.find((doc) => doc.id === id),
    [],
  );

  const getDocuments = useCallback(() => stateRef.current.documents, []);

  const getActiveId = useCallback(() => stateRef.current.activeId, []);

  const updateDocument = useCallback((id: number, patch: Partial<MarkdownDocument>) => {
    setState((current) => ({
      ...current,
      documents: current.documents.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
    }));
  }, [setState]);

  // Editors register themselves here so saves can read their live content.
  const editors = useRef(new Map<number, EditorHandle>());
  const editorRefCallbacks = useRef(new Map<number, (handle: EditorHandle | null) => void>());

  const forgetEditor = useCallback((id: number) => {
    editorRefCallbacks.current.delete(id);
  }, []);

  /** A stable ref callback for document `id`'s editor. */
  const editorRef = useCallback((id: number) => {
    let callback = editorRefCallbacks.current.get(id);
    if (!callback) {
      callback = (handle) => {
        if (handle) editors.current.set(id, handle);
        else editors.current.delete(id);
      };
      editorRefCallbacks.current.set(id, callback);
    }
    return callback;
  }, []);

  const setMarkdown = useCallback((id: number, markdown: string) => {
    updateDocument(id, { markdown });
  }, [updateDocument]);

  /** Pulls the latest content straight from the editor, ahead of its debounced onChange. */
  const syncFromEditor = useCallback((id: number) => {
    const latest = editors.current.get(id)?.getMarkdown();
    const doc = getDocument(id);
    if (doc && latest !== undefined && latest !== doc.markdown) {
      updateDocument(id, { markdown: latest });
    }
    return getDocument(id);
  }, [getDocument, updateDocument]);

  const hasUnsavedChanges = useCallback((id: number) => {
    const doc = syncFromEditor(id);
    return doc !== undefined && isDocumentDirty(doc);
  }, [syncFromEditor]);

  /**
   * The editor re-serializes documents on load (e.g. `*` bullets become `-`). Adopt its version
   * as the clean baseline so an untouched file doesn't read as modified.
   */
  const handleEditorReady = useCallback((id: number, normalized: string) => {
    const doc = getDocument(id);
    if (doc && !isDocumentDirty(doc)) {
      updateDocument(id, { markdown: normalized, savedMarkdown: normalized });
    }
  }, [getDocument, updateDocument]);

  const activate = useCallback((id: number) => {
    setState((current) =>
      current.documents.some((doc) => doc.id === id) ? { ...current, activeId: id } : current,
    );
  }, [setState]);

  const activateRelative = useCallback((offset: number) => {
    setState((current) => {
      const count = current.documents.length;
      const index = current.documents.findIndex((doc) => doc.id === current.activeId);
      return { ...current, activeId: current.documents[(index + offset + count) % count].id };
    });
  }, [setState]);

  /** Activates the tab at `index`; -1 is the last tab. */
  const activateIndex = useCallback((index: number) => {
    setState((current) => {
      const doc = current.documents[index === -1 ? current.documents.length - 1 : index];
      return doc ? { ...current, activeId: doc.id } : current;
    });
  }, [setState]);

  const newDocument = useCallback(() => {
    const doc = createDocument(null, '');
    setState((current) => ({ documents: [...current.documents, doc], activeId: doc.id }));
  }, [setState]);

  /** Opens `path` in a tab (or switches to it if already open). Missing files start empty. */
  const openPath = useCallback(async (path: string) => {
    const existing = stateRef.current.documents.find((doc) => doc.path === path);
    if (existing) {
      activate(existing.id);
      return;
    }

    const doc = createDocument(path, (await exists(path)) ? await readTextFile(path) : '');
    const active = syncFromEditor(stateRef.current.activeId);

    // Reuse the active tab if it's an untouched Untitled, e.g. the one shown at launch.
    const replaced = active && isPristine(active) ? active.id : null;
    setState((current) => ({
      documents: replaced === null
        ? [...current.documents, doc]
        : current.documents.map((d) => (d.id === replaced ? doc : d)),
      activeId: doc.id,
    }));
    if (replaced !== null) forgetEditor(replaced);
  }, [activate, forgetEditor, setState, syncFromEditor]);

  const openFiles = useCallback(async () => {
    const selected = await open({ multiple: true, filters: FILE_FILTERS });
    for (const path of selected ?? []) {
      await openPath(path);
    }
  }, [openPath]);

  const writeDocument = useCallback(async (id: number, path: string) => {
    const doc = syncFromEditor(id);
    if (!doc) return;
    await writeTextFile(path, doc.frontMatter + doc.markdown);
    updateDocument(id, { path, savedMarkdown: doc.markdown });
  }, [syncFromEditor, updateDocument]);

  /** Resolves to false if the user cancelled the save dialog. */
  const saveDocumentAs = useCallback(async (id: number): Promise<boolean> => {
    const doc = getDocument(id);
    if (!doc) return false;

    const selected = await save({ filters: FILE_FILTERS, defaultPath: doc.path ?? 'untitled.md' });
    if (!selected) return false;

    await writeDocument(id, selected);
    return true;
  }, [getDocument, writeDocument]);

  /** Resolves to false if the document was untitled and the user cancelled the save dialog. */
  const saveDocument = useCallback(async (id: number): Promise<boolean> => {
    const path = getDocument(id)?.path;
    if (!path) return saveDocumentAs(id);

    await writeDocument(id, path);
    return true;
  }, [getDocument, saveDocumentAs, writeDocument]);

  const renameDocument = useCallback(async (id: number, newPath: string) => {
    const oldPath = getDocument(id)?.path;
    if (!oldPath || oldPath === newPath) return;

    // A case-only rename finds "itself" on case-insensitive disks; that's not a conflict.
    if ((await exists(newPath)) && !(await isSameFile(oldPath, newPath))) {
      throw new Error(`${getFileName(newPath)} already exists`);
    }

    await rename(oldPath, newPath);
    updateDocument(id, { path: newPath });
  }, [getDocument, updateDocument]);

  /** Closes a tab without asking. Closing the last tab leaves an empty Untitled one. */
  const closeDocument = useCallback((id: number) => {
    setState((current) => {
      const index = current.documents.findIndex((doc) => doc.id === id);
      if (index === -1) return current;

      const documents = current.documents.filter((doc) => doc.id !== id);
      if (documents.length === 0) documents.push(createDocument(null, ''));

      const activeId = current.activeId === id
        ? documents[Math.min(index, documents.length - 1)].id
        : current.activeId;
      return { documents, activeId };
    });
    forgetEditor(id);
  }, [forgetEditor, setState]);

  return {
    documents: state.documents,
    activeId: state.activeId,
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
  };
}
