import { describe, expect, it } from 'vitest';
import { themes } from 'platform-tokens';
import { audit } from './audit';
import { contrastRatio, meetsContrast } from './contrast';
import { accessibleName } from './name';

const pairs = [
  ['text', 'bg'],
  ['text', 'bgRaised'],
  ['text', 'bgSunken'],
  ['text', 'bgSelected'],
  ['muted', 'bg'],
  ['muted', 'bgRaised'],
  ['muted', 'bgSunken'],
  ['muted', 'bgSelected'],
  ['accent', 'bg'],
  ['accentInk', 'accent'],
  ['good', 'bg'],
  ['watch', 'bg'],
  ['poor', 'bg'],
  ['poor', 'bgRaised'],
  ['info', 'bg'],
] as const;

describe('contrast', () => {
  it('computes black on white as 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('keeps both palettes on the AA side of the bar', () => {
    for (const palette of Object.values(themes)) {
      for (const [foreground, background] of pairs) {
        expect(meetsContrast(contrastRatio(palette[foreground], palette[background])), `${foreground} on ${background}`).toBe(true);
      }
    }
  });
});

describe('accessibleName', () => {
  it('reads aria-label, label for, and wrapped labels', () => {
    document.body.innerHTML = `
      <label for="query">Search routes</label>
      <input id="query" />
      <label>Owner <input id="owner" /></label>
      <button aria-label="Close dialog">×</button>
    `;
    expect(accessibleName(document.getElementById('query')!)).toBe('Search routes');
    expect(accessibleName(document.getElementById('owner')!)).toBe('Owner');
    expect(accessibleName(document.querySelector('button')!)).toBe('Close dialog');
  });
});

describe('audit', () => {
  it('flags the contracts a design system can break', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <button></button>
      <a href="/orders"></a>
      <img>
      <input id="email">
      <h1>Catalog</h1>
      <h3>Skipped</h3>
      <button tabindex="3">Later</button>
      <span id="dup"></span>
      <span id="dup"></span>
    `;
    const ids = audit(host).map((violation) => violation.id);
    expect(ids).toEqual(expect.arrayContaining([
      'button-name',
      'link-name',
      'image-alt',
      'control-name',
      'heading-order',
      'landmark-main',
      'positive-tabindex',
      'duplicate-id',
    ]));
  });

  it('accepts a view that meets the contract', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <main>
        <h1>Catalog</h1>
        <h2>Budgets</h2>
        <button>Save budget</button>
        <img alt="">
        <label for="route">Route</label>
        <input id="route">
        <a href="#content">Skip to content</a>
      </main>
    `;
    expect(audit(host)).toEqual([]);
  });
});
