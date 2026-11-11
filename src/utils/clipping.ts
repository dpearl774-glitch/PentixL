import type { Layer, VectorPath } from '../types/vector';

/** Stable SVG id for a clipping-mask source path. */
export function clipPathIdFor(pathId: string): string {
  return `pentix-clip-${pathId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/**
 * Clip that crops an image-painted object to its own outline, so the photo
 * inside a shape is the shape, not a rectangle around it.
 */
export function imageClipIdFor(pathId: string): string {
  return `pentix-image-${pathId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/**
 * Every path that can act as a clip source. Visibility is deliberately ignored:
 * hiding a source must not make its children pop out of the clip. A missing
 * source is handled with an empty clip definition instead.
 */
export function collectClippingMasks(layers: Layer[]): VectorPath[] {
  const paths = layers.flatMap((layer) => layer.paths);
  const referenced = new Set(
    paths.map((path) => path.clipPathId).filter((id): id is string => !!id)
  );
  return paths.filter(
    (path) =>
      (path.isClippingMask === true || referenced.has(path.id)) &&
      path.closed &&
      !path.text &&
      path.points.length >= 3
  );
}

/** Every clip reference currently attached to artwork, valid or dangling. */
export function collectClipIds(layers: Layer[]): Set<string> {
  return new Set(
    layers
      .flatMap((layer) => layer.paths)
      .map((path) => path.clipPathId)
      .filter((id): id is string => !!id)
  );
}

/**
 * Copying a clipped object should carry its source geometry with it. The source
 * is added as a hidden path so it defines the cut without painting.
 */
export function withClipSources(
  paths: VectorPath[],
  allPaths: VectorPath[]
): VectorPath[] {
  const byId = new Map(allPaths.map((path) => [path.id, path]));
  const included = new Set(paths.map((path) => path.id));
  const result = [...paths];

  for (const path of paths) {
    if (!path.clipPathId || included.has(path.clipPathId)) continue;
    const source = byId.get(path.clipPathId);
    if (!source || !source.closed || source.text || source.points.length < 3) continue;
    result.push({ ...source, isClippingMask: true });
    included.add(source.id);
  }

  return result;
}

/** Clear self-references, cycles, and sources that cannot define a clip. */
export function sanitizeClipReferences(layers: Layer[]): Layer[] {
  const byId = new Map<string, VectorPath>();
  for (const layer of layers) {
    for (const path of layer.paths) byId.set(path.id, path);
  }

  const invalid = new Set<string>();
  for (const layer of layers) {
    for (const path of layer.paths) {
      if (!path.clipPathId) continue;
      const seen = new Set([path.id]);
      let ref: string | undefined = path.clipPathId;
      while (ref) {
        if (seen.has(ref)) {
          invalid.add(path.id);
          break;
        }
        seen.add(ref);
        ref = byId.get(ref)?.clipPathId;
      }
    }
  }

  return layers.map((layer) => ({
    ...layer,
    paths: layer.paths.map((path) => {
      const invalidMask =
        path.isClippingMask === true &&
        (!path.closed || !!path.text || path.points.length < 3);
      if (!path.clipPathId && !invalidMask) return path;

      // Missing sources are deliberately kept: renderers turn them into an
      // empty clip, so children stay hidden instead of popping out unclipped.
      // Only self-references and cycles are cleared.
      const clearClip =
        !!path.clipPathId && (path.clipPathId === path.id || invalid.has(path.id));

      return {
        ...path,
        ...(invalidMask ? { isClippingMask: false } : {}),
        ...(clearClip ? { clipPathId: undefined } : {}),
      };
    }),
  }));
}

/**
 * Resolve a path's clip reference. A dangling id still gets a clip URL; the
 * renderers emit an empty clip path for it, so artwork cannot escape its mask.
 */
export function clippingUrlFor(path: VectorPath): string | undefined {
  return path.clipPathId ? `url(#${clipPathIdFor(path.clipPathId)})` : undefined;
}

/**
 * Selection exports only carry the selected paths. A clipped child still needs
 * its source geometry in <defs>, so pull the source in and hide it locally.
 */
export function withClipSourcesForExport(
  layers: Layer[],
  includedIds: ReadonlySet<string>
): Layer[] {
  const byId = new Map<string, VectorPath>();
  for (const layer of layers) {
    for (const path of layer.paths) byId.set(path.id, path);
  }

  const sourceIds = new Set<string>();
  for (const layer of layers) {
    for (const path of layer.paths) {
      if (!includedIds.has(path.id) || !path.clipPathId) continue;
      if (byId.has(path.clipPathId)) sourceIds.add(path.clipPathId);
    }
  }

  return layers.map((layer) => ({
    ...layer,
    paths: layer.paths
      .filter((path) => includedIds.has(path.id) || sourceIds.has(path.id))
      .map((path) =>
        sourceIds.has(path.id) && !includedIds.has(path.id)
          ? { ...path, isClippingMask: true }
          : path
      ),
  }));
}
