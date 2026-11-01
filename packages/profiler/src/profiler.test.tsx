import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { summarizeMainThread, totalBlockingTime } from './main-thread';
import { ProfiledRegion } from './react';
import { summarizeRenders, type RenderSample } from './renders';

describe('totalBlockingTime', () => {
  it('subtracts the 50ms allowance after clipping to the window', () => {
    const tasks = [
      { startTime: 0, duration: 40 },
      { startTime: 100, duration: 80, attribution: 'checkout-render' },
      { startTime: 900, duration: 200 },
    ];
    expect(totalBlockingTime(tasks)).toBe(30 + 150);
    expect(totalBlockingTime(tasks, { start: 0, end: 200 })).toBe(30);
    expect(totalBlockingTime(tasks, { start: 0, end: 150 })).toBe(0);
    expect(summarizeMainThread(tasks, 1000)).toMatchObject({
      longTaskCount: 2,
      worstTaskMs: 200,
      totalBlockingTime: 180,
    });
  });
});

describe('summarizeRenders', () => {
  it('counts commits that miss the frame budget', () => {
    const samples: RenderSample[] = [
      { id: 'list', phase: 'mount', actualDuration: 10, baseDuration: 10, startTime: 0, commitTime: 10 },
      { id: 'list', phase: 'update', actualDuration: 28, baseDuration: 12, startTime: 20, commitTime: 48 },
    ];
    expect(summarizeRenders(samples)).toMatchObject({ count: 2, slowCount: 1, overBudgetMs: 12 });
  });
});

function Probe({ onSample }: { onSample: (sample: RenderSample) => void }) {
  const [count, setCount] = useState(0);
  return (
    <ProfiledRegion id="probe" onSample={onSample}>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Count {count}
      </button>
    </ProfiledRegion>
  );
}

describe('ProfiledRegion', () => {
  it('reports a mount sample', () => {
    const onSample = vi.fn();
    render(<Probe onSample={onSample} />);
    expect(screen.getByRole('button', { name: 'Count 0' })).toBeTruthy();
    expect(onSample).toHaveBeenCalled();
    expect(onSample.mock.calls[0]?.[0]).toMatchObject({ id: 'probe', phase: 'mount' });
  });
});
