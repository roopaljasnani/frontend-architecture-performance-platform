export const themes = {
  dark: {
    bg: '#10140f',
    bgRaised: '#1b2318',
    bgSunken: '#0c100b',
    bgSelected: '#17210f',
    line: '#31402c',
    text: '#f3efe2',
    muted: '#c9d0bc',
    accent: '#d6ff4a',
    accentInk: '#172000',
    good: '#b7e3b0',
    watch: '#f0d48a',
    poor: '#ffb0a2',
    info: '#d5e4ff',
  },
  light: {
    bg: '#f4f0e4',
    bgRaised: '#fffdf8',
    bgSunken: '#e7e1d2',
    bgSelected: '#e4edc8',
    line: '#c4bba6',
    text: '#17210f',
    muted: '#3c4a32',
    accent: '#355600',
    accentInk: '#f4ffe4',
    good: '#14612c',
    watch: '#7a4b00',
    poor: '#9c2c22',
    info: '#1a4e8c',
  },
} as const;

export type ThemeName = keyof typeof themes;
export type ThemePreference = 'system' | ThemeName;
export type ColorName = keyof typeof themes.dark;

/** Dark palette. Call sites that need the active theme read the CSS variables. */
export const color = themes.dark;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  8: 48,
} as const;

export const font = {
  sans: '"Public Sans", "Avenir Next", "Segoe UI", sans-serif',
  serif: '"Newsreader", "Iowan Old Style", Palatino, serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
} as const;

export const type = {
  display: 'clamp(2.4rem, 4vw, 3.6rem)',
  title: '1.65rem',
  body: '1rem',
  small: '0.82rem',
} as const;

export const motion = {
  fast: '120ms',
  base: '180ms',
} as const;

export const radius = {
  none: '0px',
  hair: '2px',
} as const;

export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): ThemeName {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersLight ? 'light' : 'dark';
}

function variablesFor(palette: (typeof themes)[ThemeName]): string {
  return Object.entries(palette).map(([name, value]) => {
    const token = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    return `--platform-${token}:${value}`;
  }).join(';');
}

/** Both palettes. The document selects one with `data-theme`. */
export function cssVariables(): string {
  return (Object.keys(themes) as ThemeName[])
    .map((name) => `[data-theme="${name}"]{${variablesFor(themes[name])}}`)
    .join('');
}
