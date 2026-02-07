import { useEffect, useRef } from "react";
import "./App.css";
import "./editor.css";
import { Editor, EditorHandle } from "./components/Editor";
import { EditorToolbar } from "./components/EditorToolbar";
import { useMarkdownFile } from "./hooks/useMarkdownFile";

function App() {
  const editorRef = useRef<EditorHandle>(null);
  const {
    markdown,
    setMarkdown,
    currentPath,
    isDirty,
    fileVersion,
    openFile,
    saveFile,
    saveFileAs,
    newFile,
  } = useMarkdownFile();

  const handleNewFile = () => {
    // No need to check isDirty for now - we'll implement that later
    newFile();
  };

  const handleOpenFile = async () => {
    // No need to check isDirty for now - we'll implement that later
    await openFile();
  };

  const handleSave = async () => {
    const content = editorRef.current?.getMarkdown() || '';
    await saveFile(content);
  };

  const handleSaveAs = async () => {
    const content = editorRef.current?.getMarkdown() || '';
    await saveFileAs(content);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      } else if (modifier && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      } else if (modifier && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleSaveAs();
      } else if (modifier && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, currentPath, markdown]);

  // Update window title
  useEffect(() => {
    const fileName = currentPath
      ? currentPath.split(/[\\/]/).pop()
      : 'Untitled';
    document.title = `${fileName}${isDirty ? ' *' : ''} - Jot`;
  }, [currentPath, isDirty]);

  return (
    <div className="app-container">
      <EditorToolbar
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        currentFilePath={currentPath}
        hasUnsavedChanges={false}
      />
      <div className="editor-wrapper">
        <Editor key={fileVersion} value={markdown} ref={editorRef} />
      </div>
    </div>
  );
}

export default App;
