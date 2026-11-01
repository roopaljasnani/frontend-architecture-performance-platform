export interface AssetModule {
  file: string;
  gzipBytes: number;
  rawBytes: number;
}

export interface PackageCopy {
  name: string;
  version: string;
  gzipBytes: number;
  chunkId: string;
}

export interface RouteBundle {
  routeId: string;
  owner: string;
  assets: AssetModule[];
  packages: PackageCopy[];
}

export interface BudgetPolicy {
  routeId: string;
  maxGzipBytes: number;
}

export interface BundleStatsFile {
  generatedAt: string;
  maxAssetGzipBytes: number;
  routes: RouteBundle[];
  policies: BudgetPolicy[];
}

export type FindingCode =
  | 'BUDGET_EXCEEDED'
  | 'MISSING_POLICY'
  | 'DUPLICATE_MAJOR'
  | 'DUPLICATE_COPY'
  | 'OVERSIZED_ASSET';

export interface Finding {
  severity: 'error' | 'warning';
  code: FindingCode;
  message: string;
  routeId?: string;
  packageName?: string;
  bytes?: number;
  limit?: number;
}

export interface RouteRollup {
  routeId: string;
  owner: string;
  gzipBytes: number;
  maxGzipBytes: number | null;
  overBudget: boolean;
}

export interface DuplicatePackage {
  name: string;
  versions: string[];
  wastedGzipBytes: number;
  chunkIds: string[];
  consumers: string[];
}

export interface Analysis {
  routes: RouteRollup[];
  findings: Finding[];
  duplicatePackages: DuplicatePackage[];
}

export interface AnalyzeOptions {
  maxAssetGzipBytes?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function majorOf(version: string): number | null {
  const match = version.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function parseBundleStats(json: string): BundleStatsFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Bundle stats file is not valid JSON');
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.routes) || !Array.isArray(parsed.policies)) {
    throw new Error('Bundle stats file is missing routes or policies');
  }
  if (typeof parsed.maxAssetGzipBytes !== 'number' || typeof parsed.generatedAt !== 'string') {
    throw new Error('Bundle stats file is missing generatedAt or maxAssetGzipBytes');
  }
  return parsed as unknown as BundleStatsFile;
}

/** Decimal kilobytes, matching the transfer-size budgets written in the ADRs. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export function analyzeBundles(
  routes: readonly RouteBundle[],
  policies: readonly BudgetPolicy[],
  options: AnalyzeOptions = {},
): Analysis {
  const maxAssetGzipBytes = options.maxAssetGzipBytes ?? 150_000;
  const policyByRoute = new Map(policies.map((policy) => [policy.routeId, policy]));
  const findings: Finding[] = [];
  const rollups: RouteRollup[] = [];

  for (const route of routes) {
    const gzipBytes = route.assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
    const policy = policyByRoute.get(route.routeId);
    if (!policy) {
      findings.push({
        severity: 'error',
        code: 'MISSING_POLICY',
        message: `${route.routeId} has no bundle budget. Unbudgeted routes cannot ship.`,
        routeId: route.routeId,
        bytes: gzipBytes,
      });
    } else if (gzipBytes > policy.maxGzipBytes) {
      findings.push({
        severity: 'error',
        code: 'BUDGET_EXCEEDED',
        message: `${route.routeId} is ${formatBytes(gzipBytes)} gzip, over the ${formatBytes(policy.maxGzipBytes)} budget.`,
        routeId: route.routeId,
        bytes: gzipBytes,
        limit: policy.maxGzipBytes,
      });
    }

    for (const asset of route.assets) {
      if (asset.gzipBytes > maxAssetGzipBytes) {
        findings.push({
          severity: 'warning',
          code: 'OVERSIZED_ASSET',
          message: `${asset.file} is ${formatBytes(asset.gzipBytes)} gzip. Split it so one change does not invalidate ${formatBytes(asset.gzipBytes)}.`,
          routeId: route.routeId,
          bytes: asset.gzipBytes,
          limit: maxAssetGzipBytes,
        });
      }
    }

    rollups.push({
      routeId: route.routeId,
      owner: route.owner,
      gzipBytes,
      maxGzipBytes: policy?.maxGzipBytes ?? null,
      overBudget: policy ? gzipBytes > policy.maxGzipBytes : true,
    });
  }

  const grouped = new Map<string, Array<PackageCopy & { routeId: string }>>();
  for (const route of routes) {
    for (const pkg of route.packages) {
      const list = grouped.get(pkg.name) ?? [];
      list.push({ ...pkg, routeId: route.routeId });
      grouped.set(pkg.name, list);
    }
  }

  const duplicatePackages: DuplicatePackage[] = [];
  for (const [name, copies] of grouped) {
    const unique = new Map<string, PackageCopy & { routeId: string }>();
    const consumers = new Set<string>();
    for (const copy of copies) {
      consumers.add(copy.routeId);
      if (!unique.has(copy.chunkId)) unique.set(copy.chunkId, copy);
    }
    if (unique.size < 2) continue;

    const chunks = [...unique.values()];
    const versions = [...new Set(chunks.map((chunk) => chunk.version))];
    const majors = new Set(chunks.map((chunk) => majorOf(chunk.version)));
    const wastedGzipBytes = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0) - Math.max(...chunks.map((chunk) => chunk.gzipBytes));
    const duplicate: DuplicatePackage = {
      name,
      versions,
      wastedGzipBytes,
      chunkIds: chunks.map((chunk) => chunk.chunkId),
      consumers: [...consumers],
    };
    duplicatePackages.push(duplicate);

    if (majors.size > 1) {
      findings.push({
        severity: 'error',
        code: 'DUPLICATE_MAJOR',
        message: `${name} is bundled as ${versions.join(' and ')}. Align the major before extracting a shared chunk.`,
        packageName: name,
        bytes: wastedGzipBytes,
      });
    } else {
      findings.push({
        severity: 'warning',
        code: 'DUPLICATE_COPY',
        message: `${name}@${versions[0]} is copied into ${duplicate.consumers.join(' and ')} (${formatBytes(wastedGzipBytes)} wasted). Move it to a shared vendor chunk.`,
        packageName: name,
        bytes: wastedGzipBytes,
      });
    }
  }

  findings.sort((a, b) => {
    if (a.severity === b.severity) return a.code.localeCompare(b.code);
    return a.severity === 'error' ? -1 : 1;
  });

  return { routes: rollups, findings, duplicatePackages };
}

export function budgetGate(analysis: Analysis): { ok: boolean; errors: Finding[] } {
  const errors = analysis.findings.filter((finding) => finding.severity === 'error');
  return { ok: errors.length === 0, errors };
}
