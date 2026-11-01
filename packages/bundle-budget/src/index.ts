import healthyStats from '../fixtures/healthy.stats.json';
import storefrontStats from '../fixtures/storefront.stats.json';
import { parseBundleStats, type BundleStatsFile } from './analyze';

export { filesForModule, type ViteManifest, type ViteManifestChunk } from './manifest';
export {
  analyzeBundles,
  budgetGate,
  formatBytes,
  parseBundleStats,
  type Analysis,
  type AnalyzeOptions,
  type AssetModule,
  type BundleStatsFile,
  type BudgetPolicy,
  type DuplicatePackage,
  type Finding,
  type FindingCode,
  type PackageCopy,
  type RouteBundle,
  type RouteRollup,
} from './analyze';

function asStats(value: unknown): BundleStatsFile {
  return parseBundleStats(JSON.stringify(value));
}

export const storefrontFixture: BundleStatsFile = asStats(storefrontStats);
export const healthyFixture: BundleStatsFile = asStats(healthyStats);
