interface EditorToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
}

export function EditorToolbar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  currentFilePath,
  hasUnsavedChanges,
}: EditorToolbarProps) {
  const getFileName = () => {
    if (!currentFilePath) return 'Untitled';
    const parts = currentFilePath.split(/[\\/]/);
    return parts[parts.length - 1];
  };

  const canSave = currentFilePath !== null && hasUnsavedChanges;

  return (
    <div className="toolbar">
      <div className="toolbar-file-info">
        <span className="file-name">
          {getFileName()}
          {hasUnsavedChanges && ' *'}
        </span>
      </div>
      <div className="toolbar-buttons">
        <button onClick={onNew} title="New File (Cmd+N)">
          New
        </button>
        <button onClick={onOpen} title="Open File (Cmd+O)">
          Open
        </button>
        <button onClick={onSave} disabled={!canSave} title="Save (Cmd+S)">
          Save
        </button>
        <button onClick={onSaveAs} title="Save As (Cmd+Shift+S)">
          Save As
        </button>
      </div>
    </div>
  );
}
