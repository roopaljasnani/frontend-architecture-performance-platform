import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import type { RenderSample } from './renders';

export function ProfiledRegion({
  id,
  onSample,
  children,
}: {
  id: string;
  onSample: (sample: RenderSample) => void;
  children: ReactNode;
}) {
  const handleRender: ProfilerOnRenderCallback = (profileId, phase, actualDuration, baseDuration, startTime, commitTime) => {
    onSample({ id: profileId, phase, actualDuration, baseDuration, startTime, commitTime });
  };

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
