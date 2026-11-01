export interface LayoutShift {
  value: number;
  startTime: number;
  hadRecentInput: boolean;
}

/**
 * Session-window CLS.
 * Shifts with recent input are ignored. A window breaks when the gap exceeds
 * 1s or the shift would extend the window past 5s. The score is the largest window.
 */
export function cumulativeLayoutShift(shifts: readonly LayoutShift[]): number {
  let maxScore = 0;
  let sessionScore = 0;
  let sessionStart = 0;
  let previous = 0;
  let open = false;

  for (const shift of shifts) {
    if (shift.hadRecentInput || shift.value <= 0) continue;

    if (!open) {
      open = true;
      sessionScore = shift.value;
      sessionStart = shift.startTime;
      previous = shift.startTime;
      continue;
    }

    const gap = shift.startTime - previous;
    const span = shift.startTime - sessionStart;
    if (gap > 1000 || span > 5000) {
      maxScore = Math.max(maxScore, sessionScore);
      sessionScore = shift.value;
      sessionStart = shift.startTime;
    } else {
      sessionScore += shift.value;
    }
    previous = shift.startTime;
  }

  return Math.max(maxScore, sessionScore);
}
