// YAML (---) or TOML (+++) front matter at the very start of a file.
const FRONT_MATTER = /^(---|\+\+\+)[ \t]*\r?\n(?:[\s\S]*?\r?\n)?\1[ \t]*(?:\r?\n|$)/;

/**
 * Splits front matter off the start of a document. Milkdown has no front matter support (it would
 * read `---` as a horizontal rule and mangle the fields), so it's kept out of the editor and
 * written back verbatim on save.
 */
export function splitFrontMatter(content: string): [frontMatter: string, body: string] {
  const match = FRONT_MATTER.exec(content);
  if (!match) return ['', content];
  return [match[0], content.slice(match[0].length)];
}
