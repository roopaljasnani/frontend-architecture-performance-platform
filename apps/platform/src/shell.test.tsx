import { audit } from 'platform-a11y';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleBoundary } from './boundary';
import { Shell } from './shell';

function Boom({ crash }: { crash: boolean }) {
  if (crash) throw new Error('Checkout module failed while reading route state.');
  return <p>Checkout module is mounted.</p>;
}

function Lab() {
  const [crash, setCrash] = useState(false);
  const [epoch, setEpoch] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setCrash(true)}>Simulate module crash</button>
      <ModuleBoundary resetKey={String(epoch)} onReset={() => { setCrash(false); setEpoch((value) => value + 1); }}>
        <Boom crash={crash} />
      </ModuleBoundary>
    </>
  );
}

describe('platform shell', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.history.pushState({}, '', '/');
    localStorage.removeItem('platform-theme');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    document.querySelector('link[rel="canonical"]')?.remove();
    window.history.pushState({}, '', '/');
    window.matchMedia = originalMatchMedia;
    localStorage.removeItem('platform-theme');
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    vi.restoreAllMocks();
  });

  it('opens every module without breaking the accessibility contract', async () => {
    render(<Shell />);
    const screens = [
      ['Platform', 'Platform map'],
      ['Vitals', 'Core Web Vitals'],
      ['Bundles', 'Bundle budgets'],
      ['Runtime', 'Runtime profile'],
      ['Data', 'Request cache'],
      ['Accessibility', 'Accessibility contract'],
      ['Decisions', 'Architecture decisions'],
    ] as const;
    for (const [label, heading] of screens) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
      expect(audit(document), label).toEqual([]);
    }
  });

  it('recovers a crashed module', async () => {
    render(<Lab />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate module crash' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Checkout module failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry module' }));
    expect(await screen.findByText('Checkout module is mounted.')).toBeTruthy();
  });

  it('retries a broken chunk without dropping the rail', async () => {
    render(<Shell />);
    await screen.findByRole('heading', { name: 'Platform map' });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate a broken chunk' }));
    expect(await screen.findByRole('heading', { name: 'Module failed to load' })).toBeTruthy();
    expect(screen.getByText('Chunk for overview failed to fetch.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vitals' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry load' }));
    expect(await screen.findByRole('heading', { name: 'Platform map' })).toBeTruthy();
  });

  it('moves focus, the title, and the path with the module', async () => {
    render(<Shell />);
    const initial = await screen.findByRole('heading', { name: 'Platform map' });
    expect(document.activeElement).not.toBe(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Vitals' }));
    const heading = await screen.findByRole('heading', { name: 'Core Web Vitals' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.title).toBe('Vitals · Frontend Architecture & Performance Platform');
    expect(window.location.pathname).toBe('/vitals');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${window.location.origin}/vitals`);
  });

  it('runs the module, vitals, bundle, runtime, and accessibility labs', async () => {
    render(<Shell />);
    await screen.findByRole('heading', { name: 'Platform map' });

    fireEvent.click(screen.getByRole('button', { name: 'Load slow remote' }));
    expect(await screen.findByText(/exceeded 25ms/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load invalid remote' }));
    expect(await screen.findByText(/invalid-contract/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load valid remote' }));
    expect(await screen.findByText('Loaded catalog@2.1.0 from design-system.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Simulate module crash' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Checkout module failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry module' }));
    expect(await screen.findByText('Checkout module is mounted.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Vitals' }));
    expect(await screen.findByRole('heading', { name: 'Core Web Vitals' })).toBeTruthy();
    expect(screen.getByText('Beacon route /orders/:id')).toBeTruthy();
    expect(screen.getByText('Resource load duration')).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Ship' })).toBeTruthy();
    expect(screen.getAllByRole('cell', { name: 'Blocked' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Record sample' }));
    expect(screen.getAllByRole('cell', { name: '/orders/:id' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Close catalog and open checkout' }));
    expect(await screen.findByText(/not 0\.100/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Draw 100 production samples' }));
    expect(await screen.findByText('Transport received 10 of 100. Beacon route /orders/:id.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));
    expect(await screen.findByRole('heading', { name: 'Runtime profile' })).toBeTruthy();
    expect(screen.getByText('Rows mounted').parentElement?.textContent).toContain('18');
    expect(screen.getByText('of 4000 spans')).toBeTruthy();
    expect(screen.getByText(/React commits 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Run stall' }));
    expect(screen.getByText('Blocking time').parentElement?.textContent).toContain('260 ms');
    fireEvent.click(screen.getByRole('button', { name: 'Commit a React update' }));
    expect(screen.getByText(/React commits 2/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Accessibility' }));
    expect(await screen.findByRole('heading', { name: 'Accessibility contract' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Audit this page' }));
    expect(await screen.findByText('This page meets the in-repo contract.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Audit broken fixture' }));
    expect(await screen.findByText('Detached fixture')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('keeps a late response from replacing the newer record', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(await screen.findByRole('heading', { name: 'Request cache' })).toBeTruthy();
    expect(screen.getAllByText('/orders/:id').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Race two responses' }));
    expect(await screen.findByText('Showing current order. Ignored 1 late response.')).toBeTruthy();
    expect(screen.getByText('current order')).toBeTruthy();
  });

  it('traps focus in the route dialog and restores it on escape', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Accessibility' }));
    const opener = await screen.findByRole('button', { name: 'Open route dialog' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Route note' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Note' }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(audit(document)).toEqual([]);
  });

  it('filters the span list in a transition', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));
    expect(await screen.findByRole('heading', { name: 'Runtime profile' })).toBeTruthy();
    expect(screen.getByText('of 4000 spans')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Defer a slow filter' }));
    expect(await screen.findByText('Input checkout. List checkout.')).toBeTruthy();
    expect(screen.getByText(/span-1\s+checkout/)).toBeTruthy();
    expect(screen.queryByText(/span-0\s+catalog/)).toBeNull();
    expect(screen.getByText('of 1000 spans')).toBeTruthy();
  });

  it('stores a theme preference and resolves system from the OS', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('light'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
    })) as unknown as typeof window.matchMedia;
    localStorage.setItem('platform-theme', 'system');
    render(<Shell />);
    expect(await screen.findByRole('heading', { name: 'Platform map' })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), { target: { value: 'dark' } });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('platform-theme')).toBe('dark');
    expect(audit(document)).toEqual([]);
  });

  it('polls a live sequence through the request cache', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(await screen.findByRole('heading', { name: 'Request cache' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start polling' }));
    expect(await screen.findByText(/pulse [1-9]/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop polling' }));
    expect(screen.getByText('idle')).toBeTruthy();
  });

  it('accepts a tick between slices and not during a blocking scan', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Runtime' }));
    expect(await screen.findByRole('heading', { name: 'Runtime profile' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scan on this turn' }));
    const blocking = await screen.findByText(/Blocking scan visited 4000/);
    const checksum = blocking.textContent?.match(/Checksum (\d+)/)?.[1];
    expect(blocking.textContent).toContain('Ticks during scan: 0');
    fireEvent.click(screen.getByRole('button', { name: 'Scan across frames' }));
    expect((screen.getByRole('button', { name: 'Scan across frames' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Count a tick/ }));
    const sliced = await screen.findByText(/Sliced scan visited 4000/);
    expect(sliced.textContent).toContain(`Checksum ${checksum}`);
    expect(sliced.textContent).toMatch(/Ticks during scan: [1-9]/);
  });

  it('opens the full architecture decision', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Decisions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Read ADR 0001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Build-time modules, not runtime micro-frontends' });
    expect(await screen.findByText(/micro-frontends are chosen because the org chart/)).toBeTruthy();
    expect(dialog.textContent).toContain('Context');
  });

  it('shows how long the module import took', async () => {
    render(<Shell />);
    expect(await screen.findByRole('heading', { name: 'Platform map' })).toBeTruthy();
    expect(document.querySelector('.env')?.textContent).toMatch(/imported in \d+ ms/);
  });

  it('keeps a saved note and restores the previous one when the write fails', async () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: 'Accessibility' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open route dialog' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'ship catalog' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Saved "ship catalog".')).toBeTruthy();
    expect(screen.getByText('On the page: ship catalog.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open route dialog' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'do not keep' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fail this save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('The save failed. Restored "ship catalog".')).toBeTruthy();
    expect(screen.getByText('On the page: ship catalog.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
