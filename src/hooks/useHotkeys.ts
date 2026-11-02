import { useEffect, useRef } from 'react';
import { isMac } from '../utils/shortcuts';

interface HotkeyHandlers {
  onNextTab: () => void;
  onPreviousTab: () => void;
  /** 0-based; -1 means the last tab. */
  onSelectTab: (index: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

/**
 * Shortcuts handled in the webview: ones the native menu can't express (Ctrl+Tab, Mod+1…9) and
 * zoom, so variants like Mod++ work alongside the menu's Mod+=. The rest live in the menu.
 */
export function useHotkeys(handlers: HotkeyHandlers): void {
  // Read handlers through a ref so the window listener is attached once, not on every render.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      let handler: (() => void) | undefined;

      if (e.ctrlKey && e.key === 'Tab') {
        handler = e.shiftKey ? h.onPreviousTab : h.onNextTab;
      } else if (mod && !e.altKey) {
        if (/^[1-9]$/.test(e.key)) {
          const digit = Number(e.key);
          handler = () => h.onSelectTab(digit === 9 ? -1 : digit - 1);
        } else if (e.key === '=' || e.key === '+') handler = h.onZoomIn;
        else if (e.key === '-' || e.key === '_') handler = h.onZoomOut;
        else if (e.key === '0') handler = h.onZoomReset;
      }

      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
