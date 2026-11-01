import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export type FontFamily = 'serif' | 'sans' | 'mono';
export type WidthMode = 'wide' | 'narrow';
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface Preferences {
  fontFamily: FontFamily;
  widthMode: WidthMode;
  themeMode: ThemeMode;
  textScale: number;
}

export const MIN_TEXT_SCALE = 0.6;
export const MAX_TEXT_SCALE = 2.2;
const TEXT_SCALE_STEP = 0.1;

export const DEFAULT_PREFERENCES: Preferences = {
  fontFamily: 'serif',
  widthMode: 'narrow',
  themeMode: 'system',
  textScale: 1.15,
};

const STORAGE_KEY = 'jot.preferences';

function clampTextScale(scale: number): number {
  return Number(Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, scale)).toFixed(2));
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      fontFamily: oneOf(stored.fontFamily, ['serif', 'sans', 'mono'], DEFAULT_PREFERENCES.fontFamily),
      widthMode: oneOf(stored.widthMode, ['wide', 'narrow'], DEFAULT_PREFERENCES.widthMode),
      themeMode: oneOf(stored.themeMode, ['system', 'light', 'dark'], DEFAULT_PREFERENCES.themeMode),
      textScale: typeof stored.textScale === 'number'
        ? clampTextScale(stored.textScale)
        : DEFAULT_PREFERENCES.textScale,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** View preferences, persisted across launches. */
export function usePreferences() {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage unavailable; preferences just won't persist.
    }
  }, [preferences]);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const zoomIn = useCallback(() => {
    setPreferences((current) => ({ ...current, textScale: clampTextScale(current.textScale + TEXT_SCALE_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setPreferences((current) => ({ ...current, textScale: clampTextScale(current.textScale - TEXT_SCALE_STEP) }));
  }, []);

  const resetZoom = useCallback(() => {
    updatePreferences({ textScale: DEFAULT_PREFERENCES.textScale });
  }, [updatePreferences]);

  return { preferences, updatePreferences, zoomIn, zoomOut, resetZoom };
}

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function subscribeToColorScheme(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(DARK_SCHEME_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

export function useResolvedTheme(themeMode: ThemeMode): ResolvedTheme {
  const systemTheme = useSyncExternalStore(subscribeToColorScheme, getSystemTheme);
  return themeMode === 'system' ? systemTheme : themeMode;
}
