import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { visibleRange, type VisibleRange } from './window';

type ButtonVariant = 'primary' | 'quiet' | 'danger';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(
  function Button({ variant = 'quiet', children, ...props }, ref) {
    return (
      <button ref={ref} type="button" className={`platform-button platform-button-${variant}`} {...props}>
        {children}
      </button>
    );
  },
);

export function Stack({
  children,
  gap = 16,
  direction = 'column',
}: {
  children: ReactNode;
  gap?: number;
  direction?: 'column' | 'row';
}) {
  return (
    <div className="platform-stack" style={{ gap, flexDirection: direction }}>
      {children}
    </div>
  );
}

export function Panel({
  kicker,
  title,
  action,
  children,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="platform-panel">
      <header className="platform-panel-head">
        <div>
          {kicker ? <p className="platform-kicker">{kicker}</p> : null}
          <h3>{title}</h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'good' | 'watch' | 'poor';
}) {
  return (
    <article className={`platform-metric tone-${tone}`}>
      <p className="platform-kicker">{label}</p>
      <p className="platform-metric-value">{value}</p>
      {detail ? <p className="platform-muted">{detail}</p> : null}
    </article>
  );
}

export function budgetTone(value: number, max: number): 'good' | 'watch' | 'poor' {
  if (max <= 0) return 'poor';
  const ratio = value / max;
  if (ratio <= 1) return 'good';
  if (ratio <= 1.1) return 'watch';
  return 'poor';
}

export function BudgetBar({
  label,
  value,
  max,
  format = (amount: number) => amount.toLocaleString('en-US'),
}: {
  label: string;
  value: number;
  max: number;
  format?: (amount: number) => string;
}) {
  const tone = budgetTone(value, max);
  const ratio = max <= 0 ? 0 : value / max;
  return (
    <div className="platform-budget">
      <div className="platform-budget-label">
        <span>{label}</span>
        <span className="platform-mono">
          {format(value)} / {format(max)}
        </span>
      </div>
      <div
        className="platform-budget-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
      >
        <div
          className={`platform-budget-fill tone-${tone}`}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function WindowedList<T>({
  items,
  rowHeight,
  height,
  getKey,
  renderRow,
  onRange,
}: {
  items: readonly T[];
  rowHeight: number;
  height: number;
  getKey: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  onRange?: (range: VisibleRange) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const range = visibleRange({
    itemCount: items.length,
    rowHeight,
    viewportHeight: height,
    scrollTop,
  });
  useEffect(() => {
    onRange?.(range);
  }, [onRange, range.start, range.end, range.offsetY, range.totalHeight]);
  const slice = items.slice(range.start, range.end);

  return (
    <div
      className="platform-window"
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: range.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${range.offsetY}px)` }}>
          {slice.map((item, index) => (
            <div key={getKey(item)} className="platform-window-row" style={{ height: rowHeight }}>
              {renderRow(item, range.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="platform-hidden">{children}</span>;
}

export function DocLink({ href, children }: { href: string; children: string }) {
  return (
    <a className="doc-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
    </a>
  );
}

function focusableInside(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')]
    .filter((element) => !element.hasAttribute('disabled'));
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const items = panel ? focusableInside(panel) : [];
    (items[0] ?? panel)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const current = focusableInside(panel);
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="platform-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={wide ? 'platform-dialog platform-dialog-wide' : 'platform-dialog'}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
