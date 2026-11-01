import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from 'react';
import { ModuleBoundary } from './boundary';
import { importTimings, loadModule, subscribeImports } from './imports';
import { appHref, appPath } from './paths';
import { platformRegistry } from './registry';
import { SessionProvider, useSession } from './session';
import { useThemePreference } from './theme';

function moduleIdFromLocation(): string {
  if (typeof window === 'undefined') return 'overview';
  const path = appPath(window.location.pathname, import.meta.env.BASE_URL);
  const match = platformRegistry.list().find((module) => module.route === path);
  return match?.id ?? 'overview';
}

function upsertCanonical(route: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = new URL(appHref(route, import.meta.env.BASE_URL), window.location.origin).toString();
}

const viewLine: Record<string, string> = {
  overview: 'The map of this platform.',
  vitals: 'Field timings from this visit, and the lab bar a release uses.',
  bundles: 'Page weight, and a storefront that is over its budget.',
  runtime: 'The main thread, the commits, and the rows on screen.',
  data: 'A cache for the latest record, and one request the browser sends.',
  accessibility: 'Names, contrast, and a dialog that returns focus.',
  decisions: 'The choices on record, and the options turned down.',
};

export function Shell() {
  return (
    <SessionProvider>
      <ShellFrame />
    </SessionProvider>
  );
}

function ShellFrame() {
  const session = useSession();
  const [theme, chooseTheme] = useThemePreference();
  const timings = useSyncExternalStore(subscribeImports, importTimings, importTimings);
  const latestImport = timings[timings.length - 1];
  const [active, setActive] = useState(moduleIdFromLocation);
  const [Screen, setScreen] = useState<ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [brokenAttempt, setBrokenAttempt] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const skipInitialFocus = useRef(true);
  const previousModule = useRef(active);
  const restoringPath = useRef(false);

  session.setModuleId(active);
  const current = platformRegistry.get(active);
  if (current) {
    document.title = `${current.title} · Frontend Architecture & Performance Platform`;
  }

  useEffect(() => {
    const onPop = () => {
      restoringPath.current = true;
      setActive(moduleIdFromLocation());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const module = platformRegistry.get(active);
    if (!module) return;
    upsertCanonical(module.route);
    if (restoringPath.current) {
      restoringPath.current = false;
      return;
    }
    if (appPath(window.location.pathname, import.meta.env.BASE_URL) !== module.route) {
      window.history.pushState({ id: module.id }, '', appHref(module.route, import.meta.env.BASE_URL));
    }
  }, [active]);

  useEffect(() => {
    if (previousModule.current === active) return;
    previousModule.current = active;
    session.markNavigation();
  }, [active, session]);

  useEffect(() => {
    let cancelled = false;
    const module = platformRegistry.get(active);
    if (!module) return undefined;
    setScreen(null);
    setLoadError(null);
    const load = brokenAttempt === attempt
      ? Promise.reject(new Error(`Chunk for ${module.id} failed to fetch.`))
      : loadModule(module, 'navigation');
    load
      .then((loaded) => {
        if (cancelled) return;
        setScreen(() => loaded.default);
        setLoadedFor(`${active}:${attempt}`);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Module failed to load');
        setLoadedFor(`error:${active}:${attempt}`);
      });
    return () => {
      cancelled = true;
    };
  }, [active, attempt, brokenAttempt]);

  useEffect(() => {
    if (!loadedFor) return;
    const heading = document.querySelector('#content h2');
    const label = loadError ? 'Module failed to load' : current?.title ?? '';
    if (skipInitialFocus.current) {
      skipInitialFocus.current = false;
      return;
    }
    setAnnouncement(label);
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [loadedFor, loadError, current?.title]);

  function breakChunk() {
    setBrokenAttempt(attempt + 1);
    setAttempt((value) => value + 1);
  }

  return (
    <>
      <a className="skip-link" href="#content">Skip to platform content</a>
      <p className="platform-hidden" role="status">{announcement}</p>
      <div className="app">
        <aside className="rail">
          <div className="brand">
            <h1>Platform</h1>
            <p>A frontend platform, with the measurements left on.</p>
          </div>
          <nav aria-label="Platform modules">
            {platformRegistry.list().map((module, index) => (
              <button
                key={module.id}
                type="button"
                aria-label={module.title}
                aria-current={module.id === active ? 'page' : undefined}
                onFocus={() => { void loadModule(module, 'focus'); }}
                onPointerDown={() => { void loadModule(module, 'focus'); }}
                onClick={() => setActive(module.id)}
              >
                <span className="nav-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span aria-hidden="true">{module.title}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <p>{viewLine[active] ?? viewLine.overview}</p>
            <div className="topbar-tools">
              <label className="theme-control">
                Theme
                <select value={theme} onChange={(event) => chooseTheme(event.target.value as 'system' | 'light' | 'dark')}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <button type="button" className="platform-button platform-button-danger" onClick={breakChunk}>
                Simulate a broken chunk
              </button>
              {latestImport ? (
                <span className="env">{latestImport.title} imported in {Math.round(latestImport.durationMs)} ms</span>
              ) : null}
            </div>
          </header>
          <main id="content" className="canvas">
            {loadError ? (
              <div role="alert" className="failure">
                <h2>Module failed to load</h2>
                <p>{loadError}</p>
                <button type="button" className="platform-button platform-button-primary" onClick={() => setAttempt((value) => value + 1)}>
                  Retry load
                </button>
              </div>
            ) : (
              <ModuleBoundary resetKey={`${active}:${attempt}`} onReset={() => setAttempt((value) => value + 1)}>
                {Screen ? <Screen /> : <p role="status">Loading module.</p>}
              </ModuleBoundary>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
