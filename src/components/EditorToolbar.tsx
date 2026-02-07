import { useState } from 'react';
import { FilePlus2, FolderOpen, PenTool, Save } from 'lucide-react';

interface EditorToolbarProps {
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void | Promise<void>;
  onRename: (newPath: string) => void;
}

export function EditorToolbar({
  currentFilePath,
  hasUnsavedChanges,
  onNew,
  onOpen,
  onSave,
  onRename,
}: EditorToolbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const getFileName = () => {
    if (!currentFilePath) return 'Untitled';
    const parts = currentFilePath.split(/[\\/]/);
    const fullName = parts[parts.length - 1];
    // Remove extension
    const lastDot = fullName.lastIndexOf('.');
    if (lastDot > 0) {
      return fullName.substring(0, lastDot);
    }
    return fullName;
  };

  const getFileExtension = () => {
    if (!currentFilePath) return '';
    const parts = currentFilePath.split(/[\\/]/);
    const fullName = parts[parts.length - 1];
    const lastDot = fullName.lastIndexOf('.');
    if (lastDot > 0) {
      return fullName.substring(lastDot);
    }
    return '';
  };

  const handleClick = () => {
    const fileName = getFileName();
    setEditedName(fileName);
    setIsEditingName(true);
  };

  const handleNameSubmit = () => {
    if (editedName.trim() && editedName !== getFileName() && currentFilePath) {
      const pathParts = currentFilePath.split(/[\\/]/);
      const extension = getFileExtension();
      // Add extension back
      pathParts[pathParts.length - 1] = editedName.trim() + extension;
      const newPath = pathParts.join('/');
      onRename(newPath);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <PenTool size={20} className="app-logo" strokeWidth={2} />
        {!isEditingName && (
          <div className="toolbar-file-info">
            <span
              className="file-name"
              onClick={handleClick}
              title="Click to rename"
            >
              {getFileName()}
              {hasUnsavedChanges && ' *'}
            </span>
          </div>
        )}
        {isEditingName && (
          <input
            type="text"
            className="file-name-input"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        )}
      </div>
      <div className="toolbar-actions">
        <button
          className="toolbar-icon-button"
          type="button"
          onClick={onNew}
          title="New (Cmd+N)"
          aria-label="New"
        >
          <FilePlus2 size={14} />
        </button>
        <button
          className="toolbar-icon-button"
          type="button"
          onClick={onOpen}
          title="Open (Cmd+O)"
          aria-label="Open"
        >
          <FolderOpen size={14} />
        </button>
        <button
          className="toolbar-icon-button"
          type="button"
          onClick={() => void onSave()}
          title="Save (Cmd+S)"
          aria-label="Save"
          disabled={!hasUnsavedChanges}
        >
          <Save size={14} />
        </button>
      </div>
    </div>
  );
}
