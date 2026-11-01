/** Strip the GitHub Pages project prefix so module routes stay `/vitals`, not `/repo/vitals`. */
export function appPath(pathname: string, base = '/'): string {
  const prefix = base.replace(/\/$/, '');
  if (!prefix) return pathname || '/';
  if (pathname === prefix || pathname === `${prefix}/`) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || '/';
  return pathname || '/';
}

/** Put the project prefix back on before pushState and the canonical link. */
export function appHref(route: string, base = '/'): string {
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  if (route === '/') return prefix === '' ? '/' : `${prefix}/`;
  return `${prefix}${route}`;
}
