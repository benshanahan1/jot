import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkeys } from './useHotkeys';

function setPlatform(value: string): void {
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value,
  });
}

describe('useHotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes mac save hotkeys', () => {
    setPlatform('MacIntel');
    const onNew = vi.fn();
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const onSaveAs = vi.fn();

    renderHook(() => useHotkeys({ onNew, onOpen, onSave, onSaveAs }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', metaKey: true, shiftKey: true }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(onNew).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('routes ctrl shortcuts on non-mac', () => {
    setPlatform('Win32');
    const onNew = vi.fn();
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const onSaveAs = vi.fn();

    renderHook(() => useHotkeys({ onNew, onOpen, onSave, onSaveAs }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true }));

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(onSaveAs).not.toHaveBeenCalled();
  });

});
