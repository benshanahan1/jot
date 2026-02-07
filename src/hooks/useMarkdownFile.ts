import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

interface UseMarkdownFileReturn {
  markdown: string;
  setMarkdown: (content: string) => void;
  currentPath: string | null;
  isDirty: boolean;
  fileVersion: number;
  openFile: () => Promise<void>;
  saveFile: (content: string) => Promise<void>;
  saveFileAs: (content: string) => Promise<void>;
  newFile: () => void;
}

export function useMarkdownFile(): UseMarkdownFileReturn {
  const [markdown, setMarkdownState] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [fileVersion, setFileVersion] = useState<number>(0);

  const isDirty = markdown !== lastSavedContent;

  const setMarkdown = useCallback((content: string) => {
    console.log('setMarkdown called with length:', content.length);
    setMarkdownState(content);
  }, []);

  const openFile = useCallback(async () => {
    try {
      console.log('openFile called');
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }]
      });

      console.log('Dialog result:', selected);

      if (selected && typeof selected === 'string') {
        console.log('Reading file:', selected);
        const content = await readTextFile(selected);
        console.log('File content length:', content.length);
        console.log('Setting markdown state...');
        setMarkdownState(content);
        setLastSavedContent(content);
        setCurrentPath(selected);
        setFileVersion(v => v + 1);
        console.log('State updated successfully');
      } else {
        console.log('No file selected or dialog cancelled');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert(`Failed to open file: ${error}`);
    }
  }, []);

  const saveFile = useCallback(async (content: string) => {
    console.log('saveFile called, content length:', content.length);
    if (!currentPath) {
      await saveFileAs(content);
      return;
    }

    try {
      console.log('Writing to file:', currentPath);
      console.log('Content preview:', content.substring(0, 100));
      await writeTextFile(currentPath, content);
      setMarkdownState(content);
      setLastSavedContent(content);
      console.log('File saved successfully');
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Failed to save file: ${error}`);
    }
  }, [currentPath]);

  const saveFileAs = useCallback(async (content: string) => {
    try {
      const selected = await save({
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown', 'txt']
        }],
        defaultPath: currentPath || 'untitled.md'
      });

      if (selected) {
        await writeTextFile(selected, content);
        setMarkdownState(content);
        setLastSavedContent(content);
        setCurrentPath(selected);
        setFileVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Failed to save file: ${error}`);
    }
  }, [currentPath]);

  const newFile = useCallback(() => {
    setMarkdownState('');
    setLastSavedContent('');
    setCurrentPath(null);
    setFileVersion(v => v + 1);
  }, []);

  return {
    markdown,
    setMarkdown,
    currentPath,
    isDirty,
    fileVersion,
    openFile,
    saveFile,
    saveFileAs,
    newFile
  };
}
