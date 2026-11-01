export interface ViteManifestChunk {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  css?: string[];
}

export type ViteManifest = Record<string, ViteManifestChunk>;

/**
 * Files a module download includes: the shell entry, that screen's chunk, and
 * their static imports. Shared chunks are included once. Package names are not
 * in the manifest, so this cannot detect a duplicate major.
 */
export function filesForModule(manifest: ViteManifest, moduleId: string): string[] {
  const chunks = Object.entries(manifest);
  const entry = chunks.find(([, chunk]) => chunk.isEntry);
  const screen = chunks.find(([key]) => key.endsWith(`/screens/${moduleId}.tsx`) || key.endsWith(`screens/${moduleId}.tsx`));
  if (!entry || !screen) {
    throw new Error(`Manifest is missing the shell entry or the ${moduleId} screen`);
  }

  const seenKeys = new Set<string>();
  const files: string[] = [];
  const walk = (key: string) => {
    if (seenKeys.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) return;
    seenKeys.add(key);
    files.push(chunk.file);
    for (const file of chunk.css ?? []) files.push(file);
    for (const imported of chunk.imports ?? []) walk(imported);
  };

  walk(entry[0]);
  walk(screen[0]);
  return [...new Set(files)];
}
