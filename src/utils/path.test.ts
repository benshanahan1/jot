import { describe, expect, it } from 'vitest';
import {
  abbreviateHome,
  getFileName,
  getFileStem,
  isValidFileStem,
  replaceFileStem,
  splitExtension,
} from './path';

describe('path utils', () => {
  it('extracts file names across separators', () => {
    expect(getFileName('/tmp/notes.md')).toBe('notes.md');
    expect(getFileName('C:\\Users\\me\\notes.md')).toBe('notes.md');
    expect(getFileName('notes.md')).toBe('notes.md');
  });

  it('splits extensions but leaves dotfiles alone', () => {
    expect(splitExtension('notes.md')).toEqual(['notes', '.md']);
    expect(splitExtension('archive.tar.gz')).toEqual(['archive.tar', '.gz']);
    expect(splitExtension('.env')).toEqual(['.env', '']);
    expect(splitExtension('README')).toEqual(['README', '']);
    expect(getFileStem('/a/b/notes.md')).toBe('notes');
  });

  it('replaces the stem while preserving directory, separator, and extension', () => {
    expect(replaceFileStem('/tmp/old.md', 'new')).toBe('/tmp/new.md');
    expect(replaceFileStem('C:\\docs\\old.md', 'new')).toBe('C:\\docs\\new.md');
    expect(replaceFileStem('/tmp/README', 'NOTES')).toBe('/tmp/NOTES');
  });

  it('rejects stems that would escape the directory', () => {
    expect(isValidFileStem('ok name')).toBe(true);
    expect(isValidFileStem('')).toBe(false);
    expect(isValidFileStem('..')).toBe(false);
    expect(isValidFileStem('a/b')).toBe(false);
    expect(isValidFileStem('a\\b')).toBe(false);
  });

  it('abbreviates the home directory only on a path boundary', () => {
    expect(abbreviateHome('/Users/ben/notes.md', '/Users/ben')).toBe('~/notes.md');
    expect(abbreviateHome('/Users/ben/notes.md', '/Users/ben/')).toBe('~/notes.md');
    expect(abbreviateHome('/Users/bennett/notes.md', '/Users/ben')).toBe('/Users/bennett/notes.md');
    expect(abbreviateHome('/tmp/notes.md', '/Users/ben')).toBe('/tmp/notes.md');
  });
});
