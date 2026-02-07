import { useEffect, useLayoutEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { EditorView } from '@codemirror/view';
import '@milkdown/crepe/theme/frame.css';
import '@milkdown/crepe/theme/frame-dark.css';

interface EditorProps {
  value: string;
  onChange: (markdown: string) => void;
  textScale: number;
}

function refreshCodeBlockLayout(root: HTMLElement): void {
  const editorNodes = root.querySelectorAll<HTMLElement>('.milkdown-code-block .cm-editor');
  editorNodes.forEach((editorNode) => {
    const view = EditorView.findFromDOM(editorNode);
    if (!view) return;

    view.requestMeasure();
    view.dispatch({});
  });
}

export function Editor({ value, onChange, textScale }: EditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useLayoutEffect(() => {
    if (!divRef.current) return;

    let cancelled = false;

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

    crepe.on((listener) => {
      listener.markdownUpdated((_, nextMarkdown) => {
        onChangeRef.current(nextMarkdown);
      });
    });

    crepe.create().then(() => {
      // Check again before storing reference
      if (cancelled) {
        crepe.destroy();
        return;
      }

      crepeRef.current = crepe;
    });

    // Cleanup
    return () => {
      cancelled = true;
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
      // Clear the DOM content to prevent duplicates in StrictMode
      if (divRef.current) {
        divRef.current.innerHTML = '';
      }
    };
  }, []); // Initialize once per mount; App remounts by fileVersion on file lifecycle changes.

  useEffect(() => {
    const root = divRef.current;
    if (!root) return;

    // Defer until CSS variables are applied, then force CM gutters to recompute width.
    let frameA = 0;
    let frameB = 0;
    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        refreshCodeBlockLayout(root);
        window.dispatchEvent(new Event('resize'));
      });
    });

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
    };
  }, [textScale]);

  return <div ref={divRef} className="editor-container" />;
}
