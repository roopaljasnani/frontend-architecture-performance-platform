const UUID = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/**
 * Turn a raw location into a route template safe to put on a beacon.
 * Numeric ids and uuids collapse. Query strings are dropped so search terms
 * and tokens never leave the browser as metric dimensions.
 */
export function normalizeRoute(path: string): string {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? '/';
  const templated = withoutQuery.replace(UUID, '/:id').replace(/\/\d+(?=\/|$)/g, '/:id');
  return templated === '' ? '/' : templated;
}
