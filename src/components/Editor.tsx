import { Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { EditorView } from '@codemirror/view';
import '@milkdown/crepe/theme/frame.css';
import { codeHighlighting } from './codeHighlighting';

export interface EditorHandle {
  /** Serializes the live document. Undefined until the editor has finished mounting. */
  getMarkdown: () => string | undefined;
}

interface EditorProps {
  /** Markdown loaded on mount. Each document gets its own editor instance. */
  initialValue: string;
  /** Called once mounted, with the editor's serialization of `initialValue`. */
  onReady?: (markdown: string) => void;
  /** Called after edits. Milkdown debounces this, so use the handle for the very latest content. */
  onChange: (markdown: string) => void;
  textScale: number;
  /** The visible tab. Inactive editors stay mounted (keeping undo history) but hidden. */
  active: boolean;
  ref?: Ref<EditorHandle>;
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

function focusEditor(crepe: Crepe): void {
  crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
}

export function Editor({ initialValue, onReady, onChange, textScale, active, ref }: EditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const callbacksRef = useRef({ onReady, onChange });
  const activeRef = useRef(active);

  useEffect(() => {
    callbacksRef.current = { onReady, onChange };
    activeRef.current = active;
  }, [onReady, onChange, active]);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => crepeRef.current?.getMarkdown(),
  }), []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Each instance gets its own host so a StrictMode remount (or a slow async create/destroy)
    // can never leave two editors rendered side by side.
    const host = document.createElement('div');
    root.appendChild(host);

    let disposed = false;
    const crepe = new Crepe({
      root: host,
      defaultValue: initialValue,
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: 'Start writing', mode: 'doc' },
        [Crepe.Feature.CodeMirror]: { theme: codeHighlighting },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        // Debounced updates can land after the editor (and its tab) has been closed.
        if (!disposed) callbacksRef.current.onChange(markdown);
      });
    });

    const created = crepe.create().then(
      () => true,
      (error) => {
        console.error('Editor failed to load:', error);
        return false;
      },
    );
    void created.then((ok) => {
      if (!ok || disposed) return;
      crepeRef.current = crepe;
      callbacksRef.current.onReady?.(crepe.getMarkdown());
      if (activeRef.current) focusEditor(crepe);
    });

    return () => {
      disposed = true;
      crepeRef.current = null;
      host.remove();
      void created.then((ok) => {
        if (ok) void crepe.destroy();
      });
    };
  }, []); // Mount once per document; later `initialValue` changes are the editor's own edits.

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return;

    // Code blocks measured while hidden or at another scale have stale layout; refresh them once
    // the new CSS has applied. Also put the cursor back in the document on tab switches.
    let frameA = 0;
    let frameB = 0;
    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        refreshCodeBlockLayout(root);
        window.dispatchEvent(new Event('resize'));
        if (crepeRef.current) focusEditor(crepeRef.current);
      });
    });

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
    };
  }, [textScale, active]);

  return <div ref={rootRef} className="editor-container" hidden={!active} />;
}
