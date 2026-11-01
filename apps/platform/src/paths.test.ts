import { describe, expect, it } from 'vitest';
import { appHref, appPath } from './paths';

describe('pages paths', () => {
  it('leaves a local path alone', () => {
    expect(appPath('/vitals', '/')).toBe('/vitals');
    expect(appPath('/', '/')).toBe('/');
    expect(appHref('/vitals', '/')).toBe('/vitals');
    expect(appHref('/', '/')).toBe('/');
  });

  it('strips and restores a project-site prefix', () => {
    expect(appPath('/frontend-architecture-performance-platform/vitals', '/frontend-architecture-performance-platform/')).toBe('/vitals');
    expect(appPath('/frontend-architecture-performance-platform/', '/frontend-architecture-performance-platform/')).toBe('/');
    expect(appHref('/vitals', '/frontend-architecture-performance-platform/')).toBe('/frontend-architecture-performance-platform/vitals');
    expect(appHref('/', '/frontend-architecture-performance-platform/')).toBe('/frontend-architecture-performance-platform/');
  });
});
