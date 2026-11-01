export interface DecisionSummary {
  id: string;
  title: string;
  decision: string;
  rejected: string[];
  tradeoff: string;
}

export const decisions: DecisionSummary[] = [
  {
    id: '0001',
    title: 'Build-time modules, not runtime micro-frontends',
    decision: 'Each page is registered with an owner, a URL, a JavaScript budget, and the React version it is allowed to use. The app loads that page as its own file when you open it.',
    rejected: [
      'Webpack Module Federation as the default',
      'single-spa or an iframe shell',
      'One undifferentiated client bundle',
    ],
    tradeoff: 'A team cannot ship its page without the shell. In return there is one React, one set of colors, and a size check the build can fail.',
  },
  {
    id: '0002',
    title: 'The design system is a contract',
    decision: 'Shared buttons, panels, and lists are few, named for a screen reader, and checked. A long list only mounts the rows on screen. Contrast is a test, not a screenshot.',
    rejected: [
      'A large component dump with no budgets',
      'Tailwind-only sharing, with behavior left to each app',
      'CSS-in-JS theming as the platform boundary',
    ],
    tradeoff: 'There are fewer components than in a commercial kit. A new one has to have a name, work from the keyboard, and stay cheap to render. Light and dark use the same names, and both pass the contrast test.',
  },
  {
    id: '0003',
    title: 'Own the metric math',
    decision: 'The good, needs-work, and poor cutoffs for LCP, INP, and CLS live in this repo. A vendor may carry the numbers to a dashboard. The vendor does not decide what the number means.',
    rejected: [
      'Dashboard screenshots from a RUM vendor as the only source of truth',
      'React render counts as a substitute for INP',
      'Sending raw URLs, including query strings, as metric dimensions',
    ],
    tradeoff: 'The math here follows the published thresholds and the session window. It is not a copy of Chrome. Long animation frames stay in the browser.',
  },
  {
    id: '0004',
    title: 'Bundle budgets fail the build',
    decision: 'Every page has a gzip budget, and a page with no budget fails the check. React loaded once is one file. The same library loaded as two files is waste.',
    rejected: [
      'A quarterly bundle spreadsheet',
      'One global "max bundle size" with no route owner',
      'Treating a visualizer screenshot as the gate',
    ],
    tradeoff: 'A warning, such as two copies of the same version, does not fail the build. An error does. A team can treat warnings as errors later without rewriting the check.',
  },
  {
    id: '0005',
    title: 'Profile the main thread, not only React',
    decision: 'The runtime page shows two costs: how long the main thread was blocked, and how long React spent rendering. A long list only puts visible rows in the DOM.',
    rejected: [
      'memo and useMemo as the performance strategy',
      'React DevTools as the only profiler',
      'Rendering every row because the API returned every row',
    ],
    tradeoff: 'The stalls on this page are scripted, so they repeat. A production page still needs a sampled observer, or the observer itself becomes the cost. The two scans of the same list show the difference between holding the thread and giving it back.',
  },
  {
    id: '0006',
    title: 'Accessibility is a tested contract, not a scan we hope to run',
    decision: 'Buttons, inputs, headings, landmarks, and contrast are checked in tests. A product page still needs axe-core and a pass with a screen reader.',
    rejected: [
      'A manual checklist with no regression test',
      'Claiming an in-house rule engine replaces WCAG or IAAP practice',
      'Positive tabindex and unlabeled icon buttons as local exceptions',
    ],
    tradeoff: 'These rules miss a lot of WCAG. The route dialog has its own test for the focus trap, because the rule list cannot see one.',
  },
  {
    id: '0007',
    title: 'Remote modules are an escape hatch',
    decision: 'Loading a script from another origin is allowed only with a timeout, a shape check, and a visible failure. It is the exception, not how pages are composed.',
    rejected: [
      'Importing any URL the catalog team publishes',
      'Sharing runtime state across remotes by reaching into window',
      'Blocking the shell until a third-party script decides to respond',
    ],
    tradeoff: 'Use it for a surface that really is deployed on its own. That means two versions can drift, someone has to be able to turn it off, and someone has to own it.',
  },
  {
    id: '0008',
    title: 'Cache records by route template',
    decision: 'A record is stored under the route pattern, such as /orders/:id, not the full address. A newer request wins. A response that arrives late, or a request you cancelled, does not replace what is already on screen.',
    rejected: [
      'Letting every screen invent its own loading flag',
      'Keying the cache by the raw URL, including tokens',
      'Applying responses in arrival order',
    ],
    tradeoff: 'The cache lives in memory. It does not survive a reload, and two requests already sent both hit the fetcher. ADR 0013 copies a landed record to other tabs. The rule here is which response is allowed to win.',
  },
  {
    id: '0009',
    title: 'One token set, two palettes',
    decision: 'Light and dark use the same color names. The document picks one with data-theme. System follows the operating system. A choice you make is stored in this browser.',
    rejected: [
      'A second hex palette inside each component',
      'Following the OS with no stored choice',
      'A theme class that bypasses the contrast test',
    ],
    tradeoff: 'The bright green used as text on the dark background is too light to be text on a white page. The two palettes swap which color is the ink. The layout stays the same.',
  },
  {
    id: '0010',
    title: 'Poll on a timer, through the cache',
    decision: 'Polling keeps one request open. A tick that arrives while that request is still running is skipped. An error doubles the wait. Hiding the tab cancels the request and stops the timer.',
    rejected: [
      'A queue of overlapping polls',
      'Retrying an error on the same interval',
      'A loading flag per screen',
    ],
    tradeoff: 'A skipped tick is a missed sample. The record is only as fresh as the slower of the interval and the request. The race buttons use a fixed delay so that result does not depend on the clock.',
  },
  {
    id: '0011',
    title: 'Start the download on focus, and time it',
    decision: 'Focusing or pressing a page in the rail starts that page’s JavaScript download. The shell records how long the import took. Opening the page reuses the download if it already started.',
    rejected: [
      'Waiting until the click to start the download',
      'A modulepreload link for every page in the first HTML',
      'Starting a download when the pointer merely hovers',
    ],
    tradeoff: 'The first focus pays for a file the person might not open. The recorded time is the import, not how long the page took to paint.',
  },
  {
    id: '0012',
    title: 'Show the save, then undo it if the write fails',
    decision: 'Save puts the note on the page immediately. If the write fails, the previous note comes back. Close throws away the draft and leaves the saved note alone.',
    rejected: [
      'A Save button that only closes the dialog',
      'Waiting to show the note until the response arrives',
      'Leaving a rejected note on the page',
    ],
    tradeoff: 'For a moment the page shows a note the server has not accepted. Putting the previous note back is what makes that honest. React 19 has useOptimistic. This app is React 18, so the same steps are written out.',
  },
  {
    id: '0013',
    title: 'Tell the other tab when a record lands',
    decision: 'When a cache entry lands, it is posted on a BroadcastChannel named platform-catalog. Another tab applies it when the generation is newer. A second cache on this page listens the same way and does not fetch.',
    rejected: [
      'A service worker as the only way to share the cache',
      'Letting an older message overwrite a newer one',
      'Fetching the same pulse again in the other tab',
    ],
    tradeoff: 'The channel is same-origin and in memory. A reload starts empty. The other tab sees the result. It does not cancel the request this tab already sent. ADR 0014 caches a different request.',
  },
  {
    id: '0014',
    title: 'Let a service worker answer one request',
    decision: 'The Data page calls fetch for catalog records and for /api/pulse. A service worker answers those two URLs, stores the pulse body in Cache Storage, and can serve or fail the next pulse. The in-memory cache and the BroadcastChannel stay as they are.',
    rejected: [
      'Using the worker as the only cache for the catalog',
      'Letting the worker handle every request, including page files',
      'Registering the worker from the shell, on every page',
    ],
    tradeoff: 'The stored body survives a reload of this origin until the cache is cleared. It is not the in-memory pulse, and it does not update the other tab.',
  },
];
