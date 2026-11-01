import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { analyzeBundles, budgetGate, filesForModule, formatBytes, type ViteManifest } from 'platform-bundle-budget';
import { platformRegistry } from '../apps/platform/src/registry';

const dist = path.resolve('apps/platform/dist');
const manifestPath = path.join(dist, '.vite/manifest.json');

if (!existsSync(manifestPath)) {
  console.error('Missing Vite manifest. Run npm run build first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ViteManifest;
const gzipByFile = new Map<string, number>();

function gzipOf(file: string): number {
  const cached = gzipByFile.get(file);
  if (cached !== undefined) return cached;
  const size = gzipSync(readFileSync(path.join(dist, file))).length;
  gzipByFile.set(file, size);
  return size;
}

const modules = platformRegistry.list();
const routes = modules.map((module) => {
  const files = filesForModule(manifest, module.id);
  return {
    routeId: module.id,
    owner: module.owner,
    assets: files.map((file) => ({ file, gzipBytes: gzipOf(file), rawBytes: gzipOf(file) })),
    packages: [],
  };
});
const policies = modules.map((module) => ({
  routeId: module.id,
  maxGzipBytes: module.budgets.maxGzipBytes,
}));
const analysis = analyzeBundles(routes, policies);
const gate = budgetGate(analysis);

for (const route of analysis.routes) {
  const limit = route.maxGzipBytes === null ? 'none' : formatBytes(route.maxGzipBytes);
  console.log(`${route.routeId} ${formatBytes(route.gzipBytes)} / ${limit}`);
}

if (!gate.ok) {
  for (const error of gate.errors) console.error(error.message);
  process.exit(1);
}

console.log('Shell bundle gate passed.');
