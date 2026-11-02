export const isMac = () => navigator.platform.toUpperCase().includes('MAC');

/** Formats a shortcut like `Mod+Shift+S` for display: `⇧⌘S` on macOS, `Ctrl+Shift+S` elsewhere. */
function formatShortcut(shortcut: string): string {
  const parts = shortcut.split('+');
  if (!isMac()) return parts.map((part) => (part === 'Mod' ? 'Ctrl' : part)).join('+');

  const symbols: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' };
  const key = parts.pop() ?? '';
  const order = ['Ctrl', 'Alt', 'Shift', 'Mod'];
  return parts
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((part) => symbols[part] ?? part)
    .join('') + key;
}

/** `Save (⌘S)` */
export const withShortcut = (label: string, shortcut: string) => `${label} (${formatShortcut(shortcut)})`;
