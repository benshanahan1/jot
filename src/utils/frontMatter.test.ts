import { describe, expect, it } from 'vitest';
import { splitFrontMatter } from './frontMatter';

describe('splitFrontMatter', () => {
  it('splits YAML and TOML front matter from the body', () => {
    expect(splitFrontMatter('---\ntitle: x\n---\n# Hi\n')).toEqual(['---\ntitle: x\n---\n', '# Hi\n']);
    expect(splitFrontMatter('+++\ntitle = "x"\n+++\nbody')).toEqual(['+++\ntitle = "x"\n+++\n', 'body']);
    expect(splitFrontMatter('---\r\na: 1\r\n---\r\nbody')).toEqual(['---\r\na: 1\r\n---\r\n', 'body']);
  });

  it('handles empty front matter and front matter with no body', () => {
    expect(splitFrontMatter('---\n---\nbody')).toEqual(['---\n---\n', 'body']);
    expect(splitFrontMatter('---\na: 1\n---')).toEqual(['---\na: 1\n---', '']);
  });

  it('leaves documents without front matter alone', () => {
    expect(splitFrontMatter('# Title\n\n---\n\ntext')).toEqual(['', '# Title\n\n---\n\ntext']);
    expect(splitFrontMatter('---\nunterminated')).toEqual(['', '---\nunterminated']);
    expect(splitFrontMatter('')).toEqual(['', '']);
  });
});
