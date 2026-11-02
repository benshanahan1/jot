const SEPARATOR = /[\\/]/;

export function getFileName(path: string): string {
  return path.split(SEPARATOR).pop() ?? path;
}

/** Splits `notes.md` into `['notes', '.md']`. Dotfiles like `.env` have no extension. */
export function splitExtension(fileName: string): [stem: string, extension: string] {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return [fileName, ''];
  return [fileName.slice(0, lastDot), fileName.slice(lastDot)];
}

/** The name shown for a document: its file name, or `Untitled` if it has never been saved. */
export function getDisplayName(path: string | null): string {
  return path ? getFileName(path) : 'Untitled';
}

export function getFileStem(path: string): string {
  return splitExtension(getFileName(path))[0];
}

/** Returns `path` with its file name (minus extension) replaced, keeping the directory and extension. */
export function replaceFileStem(path: string, stem: string): string {
  const fileName = getFileName(path);
  const [, extension] = splitExtension(fileName);
  return path.slice(0, path.length - fileName.length) + stem + extension;
}

export function isValidFileStem(stem: string): boolean {
  return stem.length > 0 && stem !== '.' && stem !== '..' && !SEPARATOR.test(stem);
}

/** Abbreviates the home directory to `~` for display. */
export function abbreviateHome(path: string, home: string): string {
  const trimmedHome = home.replace(/[\\/]+$/, '');
  if (!trimmedHome || !path.startsWith(trimmedHome)) return path;
  const rest = path.slice(trimmedHome.length);
  if (rest !== '' && !SEPARATOR.test(rest[0])) return path;
  return `~${rest}`;
}
