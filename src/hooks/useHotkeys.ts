import { useEffect } from 'react';

interface HotkeyHandlers {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  enabled?: boolean;
  enableFileShortcuts?: boolean;
  enableZoomShortcuts?: boolean;
}

export function useHotkeys({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  enabled = true,
  enableFileShortcuts = true,
  enableZoomShortcuts = true,
}: HotkeyHandlers): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      if (!modifier) return;

      if (enableFileShortcuts && key === 'n') {
        e.preventDefault();
        onNew();
      } else if (enableFileShortcuts && key === 'o') {
        e.preventDefault();
        onOpen();
      } else if (enableFileShortcuts && e.shiftKey && key === 's') {
        e.preventDefault();
        onSaveAs();
      } else if (enableFileShortcuts && key === 's') {
        e.preventDefault();
        onSave();
      } else if (
        enableZoomShortcuts &&
        (key === '+' || key === 'add' || key === '=' || (key === '=' && e.shiftKey))
      ) {
        e.preventDefault();
        onZoomIn?.();
      } else if (enableZoomShortcuts && (key === '-' || key === '_' || key === 'subtract')) {
        e.preventDefault();
        onZoomOut?.();
      } else if (enableZoomShortcuts && key === '0') {
        e.preventDefault();
        onZoomReset?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    enabled,
    enableFileShortcuts,
    enableZoomShortcuts,
  ]);
}
