export interface VisibleRange {
  start: number;
  end: number;
  offsetY: number;
  totalHeight: number;
}

/** The runtime page list. Both the screen and the adoption report use these numbers. */
export const referenceList = {
  itemCount: 4000,
  rowHeight: 28,
  viewportHeight: 280,
  scrollTop: 0,
} as const;

export function mountCost(options: {
  itemCount: number;
  rowHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
}): { mounted: number; full: number; skipped: number } {
  const range = visibleRange(options);
  const mounted = range.end - range.start;
  return { mounted, full: options.itemCount, skipped: options.itemCount - mounted };
}

export function visibleRange(options: {
  itemCount: number;
  rowHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
}): VisibleRange {
  const overscan = options.overscan ?? 4;
  const rowHeight = Math.max(1, options.rowHeight);
  const start = Math.max(0, Math.floor(Math.max(0, options.scrollTop) / rowHeight) - overscan);
  const visibleCount = Math.max(1, Math.ceil(options.viewportHeight / rowHeight));
  const end = Math.min(options.itemCount, start + visibleCount + overscan * 2);
  return {
    start,
    end,
    offsetY: start * rowHeight,
    totalHeight: options.itemCount * rowHeight,
  };
}
