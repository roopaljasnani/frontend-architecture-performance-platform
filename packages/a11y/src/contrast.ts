export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(input: string): Rgb {
  const hex = input.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Expected a 6-digit hex color, received ${input}`);
  }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channel(value: number): number {
  const scale = value / 255;
  return scale <= 0.04045 ? scale / 12.92 : ((scale + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(parseHex(foreground)), relativeLuminance(parseHex(background)));
  const darker = Math.min(relativeLuminance(parseHex(foreground)), relativeLuminance(parseHex(background)));
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastRequirement {
  largeText?: boolean;
  uiComponent?: boolean;
  level?: 'AA' | 'AAA';
}

/** WCAG 2.2 contrast minimums. Large text and UI components share the lower AA bar. */
export function requiredContrast({ largeText = false, uiComponent = false, level = 'AA' }: ContrastRequirement = {}): number {
  if (level === 'AAA') return largeText ? 4.5 : 7;
  return largeText || uiComponent ? 3 : 4.5;
}

export function meetsContrast(ratio: number, requirement: ContrastRequirement = {}): boolean {
  return ratio >= requiredContrast(requirement);
}
