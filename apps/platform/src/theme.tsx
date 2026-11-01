import { resolveTheme, type ThemePreference } from 'platform-tokens';
import { useEffect, useState } from 'react';

/** `index.html` reads this same key before paint. Keep the two in step. */
export const themeStorageKey = 'platform-theme';

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage can be blocked. The document stays on the resolved system theme.
  }
  return 'system';
}

function systemPrefersLight(): boolean {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  } catch {
    return false;
  }
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference, systemPrefersLight());
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyTheme(preference);
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const onChange = () => applyTheme(preference);
    media?.addEventListener?.('change', onChange);
    return () => media?.removeEventListener?.('change', onChange);
  }, [preference]);

  function choose(next: ThemePreference) {
    setPreference(next);
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      // The choice still applies for this document.
    }
  }

  return [preference, choose];
}
