import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, remove } from '@tauri-apps/plugin-fs';

interface UseMarkdownFileReturn {
  markdown: string;
  setMarkdown: (content: string) => void;
  currentPath: string | null;
  isDirty: boolean;
  fileVersion: number;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  newFile: () => void;
  renameFile: (newPath: string) => Promise<void>;
}

export function useMarkdownFile(): UseMarkdownFileReturn {
  const [markdown, setMarkdownState] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [fileVersion, setFileVersion] = useState<number>(0);

  const isDirty = markdown !== lastSavedContent;

  const setMarkdown = useCallback((content: string) => {
    setMarkdownState(content);
  }, []);

  const openFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        setMarkdownState(content);
        setLastSavedContent(content);
        setCurrentPath(selected);
        setFileVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert(`Failed to open file: ${error}`);
    }
  }, []);

  const saveFileAs = useCallback(async () => {
    try {
      const selected = await save({
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }],
        defaultPath: currentPath || 'untitled.md'
      });

      if (selected) {
        await writeTextFile(selected, markdown);
        setLastSavedContent(markdown);
        setCurrentPath(selected);
        setFileVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Failed to save file: ${error}`);
    }
  }, [currentPath, markdown]);

  const saveFile = useCallback(async () => {
    if (!currentPath) {
      await saveFileAs();
      return;
    }

    try {
      await writeTextFile(currentPath, markdown);
      setLastSavedContent(markdown);
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Failed to save file: ${error}`);
    }
  }, [currentPath, markdown, saveFileAs]);

  const newFile = useCallback(() => {
    setMarkdownState('');
    setLastSavedContent('');
    setCurrentPath(null);
    setFileVersion(v => v + 1);
  }, []);

  const renameFile = useCallback(async (newPath: string) => {
    if (!currentPath || currentPath === newPath) return;

    try {
      const content = await readTextFile(currentPath);
      await writeTextFile(newPath, content);
      await remove(currentPath);
      setCurrentPath(newPath);
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  }, [currentPath]);

  return {
    markdown,
    setMarkdown,
    currentPath,
    isDirty,
    fileVersion,
    openFile,
    saveFile,
    saveFileAs,
    newFile,
    renameFile,
  };
}
