import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkeys } from './useHotkeys';

function setPlatform(value: string): void {
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value,
  });
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

function makeHandlers() {
  return {
    onNextTab: vi.fn(),
    onPreviousTab: vi.fn(),
    onSelectTab: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
  };
}

describe('useHotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches tabs with Ctrl+Tab and Mod+number', () => {
    setPlatform('MacIntel');
    const handlers = makeHandlers();
    renderHook(() => useHotkeys(handlers));

    expect(press('Tab', { ctrlKey: true }).defaultPrevented).toBe(true);
    press('Tab', { ctrlKey: true, shiftKey: true });
    press('2', { metaKey: true });
    press('9', { metaKey: true });
    press('2', { ctrlKey: true });

    expect(handlers.onNextTab).toHaveBeenCalledTimes(1);
    expect(handlers.onPreviousTab).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectTab.mock.calls).toEqual([[1], [-1]]);
  });

  it('uses Ctrl as the modifier on other platforms', () => {
    setPlatform('Win32');
    const handlers = makeHandlers();
    renderHook(() => useHotkeys(handlers));

    press('1', { ctrlKey: true });
    press('1', { metaKey: true });

    expect(handlers.onSelectTab.mock.calls).toEqual([[0]]);
  });

  it('handles zoom key variants and leaves other shortcuts to the menu', () => {
    setPlatform('MacIntel');
    const handlers = makeHandlers();
    renderHook(() => useHotkeys(handlers));

    press('=', { metaKey: true });
    press('+', { metaKey: true, shiftKey: true });
    press('-', { metaKey: true });
    press('0', { metaKey: true });
    expect(press('s', { metaKey: true }).defaultPrevented).toBe(false);
    expect(press('1', { metaKey: true, altKey: true }).defaultPrevented).toBe(false);

    expect(handlers.onZoomIn).toHaveBeenCalledTimes(2);
    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomReset).toHaveBeenCalledTimes(1);
  });

  it('calls the latest handlers after a rerender', () => {
    setPlatform('MacIntel');
    const first = makeHandlers();
    const second = makeHandlers();
    const { rerender } = renderHook((handlers) => useHotkeys(handlers), { initialProps: first });

    rerender(second);
    press('Tab', { ctrlKey: true });

    expect(first.onNextTab).not.toHaveBeenCalled();
    expect(second.onNextTab).toHaveBeenCalledTimes(1);
  });
});
