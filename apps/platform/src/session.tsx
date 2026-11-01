import { attachWebVitals, createCollector, type Collector, type VitalSubscription } from 'platform-vitals';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

interface Session {
  collector: Collector;
  markNavigation: () => void;
  setModuleId: (id: string) => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const moduleId = useRef('overview');
  const collectorRef = useRef<Collector | null>(null);
  if (!collectorRef.current) {
    collectorRef.current = createCollector({
      getRoute: () => (typeof window === 'undefined' ? '/' : window.location.pathname),
      getModuleId: () => moduleId.current,
    });
  }
  const subscription = useRef<VitalSubscription | null>(null);

  useEffect(() => {
    const collector = collectorRef.current;
    if (!collector) return undefined;
    subscription.current = attachWebVitals(collector);
    return () => subscription.current?.stop();
  }, []);

  const markNavigation = useCallback(() => {
    if (subscription.current) subscription.current.markNavigation();
    else collectorRef.current?.nextNavigation();
  }, []);

  const setModuleId = useCallback((id: string) => {
    moduleId.current = id;
  }, []);

  const value = useMemo<Session>(() => ({
    collector: collectorRef.current as Collector,
    markNavigation,
    setModuleId,
  }), [markNavigation, setModuleId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
