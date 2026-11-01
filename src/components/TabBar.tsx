import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { isDocumentDirty, type MarkdownDocument } from '../hooks/useDocuments';
import { getFileName, getFileStem } from '../utils/path';
import { withShortcut } from '../utils/shortcuts';

interface TabBarProps {
  documents: MarkdownDocument[];
  activeId: number;
  renamingId: number | null;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
  onStartRename: (id: number) => void;
  onCancelRename: () => void;
  onRename: (id: number, newStem: string) => void;
}

function RenameInput({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const cancelledRef = useRef(false);

  return (
    <input
      type="text"
      className="tab-rename-input"
      aria-label="File name"
      value={value}
      size={Math.max(4, value.length)}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        if (!cancelledRef.current) onSubmit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          cancelledRef.current = true;
          onCancel();
        }
      }}
      autoFocus
    />
  );
}

export function TabBar({
  documents,
  activeId,
  renamingId,
  onActivate,
  onClose,
  onNew,
  onStartRename,
  onCancelRename,
  onRename,
}: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tabs" role="tablist">
        {documents.map((doc) => {
          const isActive = doc.id === activeId;
          const isDirty = isDocumentDirty(doc);

          return (
            <div
              key={doc.id}
              className={`tab${isActive ? ' active' : ''}${isDirty ? ' dirty' : ''}`}
              role="tab"
              aria-selected={isActive}
              title={doc.path ?? 'Untitled'}
              onMouseDown={(e) => {
                // Middle-click closes, like a browser.
                if (e.button === 1) {
                  e.preventDefault();
                  onClose(doc.id);
                }
              }}
              onClick={() => onActivate(doc.id)}
              onDoubleClick={() => onStartRename(doc.id)}
            >
              {renamingId === doc.id && doc.path ? (
                <RenameInput
                  initialValue={getFileStem(doc.path)}
                  onSubmit={(stem) => onRename(doc.id, stem)}
                  onCancel={onCancelRename}
                />
              ) : (
                <span className="tab-label">{doc.path ? getFileName(doc.path) : 'Untitled'}</span>
              )}
              <button
                type="button"
                className="tab-close"
                aria-label={isDirty ? 'Close (unsaved changes)' : 'Close'}
                title={withShortcut('Close Tab', 'Mod+W')}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(doc.id);
                }}
              >
                <span className="tab-dirty-mark" aria-hidden />
                <X className="tab-close-icon" size={12} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="tab-new"
        aria-label="New tab"
        title={withShortcut('New Tab', 'Mod+N')}
        onClick={onNew}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
