import { useRef, useLayoutEffect, useImperativeHandle, forwardRef } from 'react';
import { Crepe } from '@milkdown/crepe';

interface EditorProps {
  value: string;
  onChange?: (markdown: string) => void;
}

export interface EditorHandle {
  getMarkdown: () => string;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(({ value, onChange }, ref) => {
  const divRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const valueRef = useRef<string>(value);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => {
      if (crepeRef.current) {
        return crepeRef.current.getMarkdown();
      }
      return '';
    }
  }));

  useLayoutEffect(() => {
    if (!divRef.current) return;

    let cancelled = false;

    // Detect dark mode
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Dynamically import the appropriate theme
    const themePromise = isDark
      ? import('@milkdown/crepe/theme/frame-dark.css')
      : import('@milkdown/crepe/theme/frame.css');

    themePromise.then(() => {
      // Don't create editor if effect was cleaned up
      if (cancelled) return;

      // Destroy existing editor if it exists
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }

      // Clear any existing DOM content
      if (divRef.current) {
        divRef.current.innerHTML = '';
      }

      // Create Crepe instance with current value
      const crepe = new Crepe({
        root: divRef.current!,
        defaultValue: value,
        features: {
          // Enable all default features
        },
      });

      crepe.create().then(() => {
        // Check again before storing reference
        if (cancelled) {
          crepe.destroy();
          return;
        }

        console.log('Crepe editor created with value length:', value.length);
        crepeRef.current = crepe;
      });
    });

    // Listen for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (crepeRef.current) {
        crepeRef.current.destroy();
      }
      window.location.reload();
    };

    mediaQuery.addEventListener('change', handleThemeChange);

    // Cleanup
    return () => {
      cancelled = true;
      mediaQuery.removeEventListener('change', handleThemeChange);
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
      // Clear the DOM content to prevent duplicates in StrictMode
      if (divRef.current) {
        divRef.current.innerHTML = '';
      }
    };
  }, [value]); // Recreate editor when value changes

  return <div ref={divRef} className="editor-container" />;
});
