export interface VisibleRange {
  start: number;
  end: number;
  offsetY: number;
  totalHeight: number;
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
