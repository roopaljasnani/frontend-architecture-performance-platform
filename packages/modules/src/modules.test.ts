import { describe, expect, it } from 'vitest';
import { isRemoteModuleContract, loadRemoteModule } from './remote';
import { createRegistry, type ModuleContract } from './registry';
import { claimsFrom, resolveShared } from './shared';

const checkout: ModuleContract = {
  id: 'checkout',
  version: '1.4.0',
  owner: 'payments',
  title: 'Checkout',
  route: '/checkout',
  budgets: { maxGzipBytes: 160_000, maxInpMs: 200 },
  shared: [{ name: 'react', range: '^18.3.1' }],
};

describe('registry', () => {
  it('rejects duplicate and unsafe ids', () => {
    const registry = createRegistry<{ default: string }>();
    registry.register({ ...checkout, load: async () => ({ default: 'ok' }) });
    expect(() => registry.register({ ...checkout, load: async () => ({ default: 'ok' }) })).toThrow(/already registered/);
    expect(() => registry.register({ ...checkout, id: 'Checkout', load: async () => ({ default: 'ok' }) })).toThrow(/kebab-case/);
  });
});

describe('resolveShared', () => {
  it('accepts one React major and rejects a second', () => {
    const healthy = resolveShared(claimsFrom([checkout, { ...checkout, id: 'catalog' }]));
    expect(healthy.ok).toBe(true);
    expect(healthy.resolved).toEqual([{ name: 'react', major: 18, consumers: ['checkout', 'catalog'] }]);

    const broken = resolveShared(claimsFrom([
      checkout,
      { ...checkout, id: 'legacy-checkout', shared: [{ name: 'react', range: '^17.0.2' }] },
    ]));
    expect(broken.ok).toBe(false);
    expect(broken.conflicts[0]?.name).toBe('react');
  });
});

describe('loadRemoteModule', () => {
  it('returns a valid module, a contract failure, a load failure, and a timeout', async () => {
    const valid = await loadRemoteModule({
      url: 'https://cdn.example/catalog.js',
      timeoutMs: 50,
      loader: async () => ({ id: 'catalog', version: '1.0.0', owner: 'design-system' }),
      isValid: isRemoteModuleContract,
    });
    expect(valid.ok).toBe(true);

    const invalid = await loadRemoteModule({
      url: 'https://cdn.example/bad.js',
      timeoutMs: 50,
      loader: async () => ({ unexpected: true }),
      isValid: isRemoteModuleContract,
    });
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-contract' });

    const failed = await loadRemoteModule({
      url: 'https://cdn.example/down.js',
      timeoutMs: 50,
      loader: async () => {
        throw new Error('network down');
      },
      isValid: isRemoteModuleContract,
    });
    expect(failed).toMatchObject({ ok: false, reason: 'load-error', message: 'network down' });

    const timedOut = await loadRemoteModule({
      url: 'https://cdn.example/slow.js',
      timeoutMs: 20,
      loader: () => new Promise(() => {}),
      isValid: isRemoteModuleContract,
    });
    expect(timedOut).toMatchObject({ ok: false, reason: 'timeout' });
  });
});
