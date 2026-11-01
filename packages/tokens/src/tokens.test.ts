import { describe, expect, it } from 'vitest';
import { color, cssVariables, resolveTheme, space, themes } from './index';

describe('tokens', () => {
  it('publishes hex colors and a stable spacing scale', () => {
    for (const palette of Object.values(themes)) {
      for (const value of Object.values(palette)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(space[2]).toBe(space[1] * 2);
    expect(space[4]).toBe(space[2] * 2);
  });

  it('emits both palettes as CSS variables', () => {
    const css = cssVariables();
    expect(css).toContain(`[data-theme="dark"]`);
    expect(css).toContain(`[data-theme="light"]`);
    expect(css).toContain(`--platform-bg:${color.bg}`);
    expect(css).toContain(`--platform-bg-selected:${themes.light.bgSelected}`);
    expect(css).toContain(`--platform-accent-ink:${themes.light.accentInk}`);
  });

  it('resolves system from the OS preference and keeps an explicit choice', () => {
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });
});
