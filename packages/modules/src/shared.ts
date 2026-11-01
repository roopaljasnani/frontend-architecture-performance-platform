import type { ModuleContract, SharedDependency } from './registry';

export interface SharedClaim extends SharedDependency {
  moduleId: string;
}

export interface SharedResolution {
  ok: boolean;
  resolved: Array<{ name: string; major: number; consumers: string[] }>;
  conflicts: Array<{ name: string; majors: Array<{ major: number; consumers: string[] }> }>;
}

export function majorOfRange(range: string): number | null {
  const match = range.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function claimsFrom(modules: readonly Pick<ModuleContract, 'id' | 'shared'>[]): SharedClaim[] {
  return modules.flatMap((module) => module.shared.map((shared) => ({ ...shared, moduleId: module.id })));
}

/**
 * The shell supplies one major per shared package.
 * Different majors fail closed. Compatible minors are the platform's problem
 * to provide, not each module's problem to bundle.
 */
export function resolveShared(claims: readonly SharedClaim[]): SharedResolution {
  const byName = new Map<string, Map<number, string[]>>();
  for (const claim of claims) {
    const major = majorOfRange(claim.range) ?? -1;
    const majors = byName.get(claim.name) ?? new Map<number, string[]>();
    const consumers = majors.get(major) ?? [];
    consumers.push(claim.moduleId);
    majors.set(major, consumers);
    byName.set(claim.name, majors);
  }

  const resolved: SharedResolution['resolved'] = [];
  const conflicts: SharedResolution['conflicts'] = [];
  for (const [name, majors] of byName) {
    const entries = [...majors.entries()].map(([major, consumers]) => ({ major, consumers }));
    if (entries.length === 1 && entries[0] && entries[0].major >= 0) {
      resolved.push({ name, major: entries[0].major, consumers: entries[0].consumers });
    } else {
      conflicts.push({ name, majors: entries });
    }
  }

  return { ok: conflicts.length === 0, resolved, conflicts };
}
