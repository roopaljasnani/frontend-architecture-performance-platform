import { commitOptimistic } from 'platform-data';
import { audit, contrastRatio, meetsContrast, type Violation } from 'platform-a11y';
import { themes } from 'platform-tokens';
import { Button, Dialog, DocLink, Metric, Panel } from 'platform-ui';
import { useMemo, useRef, useState } from 'react';

const fixture = `
  <button></button>
  <img>
  <h1>Orders</h1>
  <h3>Payment</h3>
  <input id="card">
  <a href="/pay"></a>
`;

function describe(ratio: number): string {
  const aa = meetsContrast(ratio);
  const aaa = meetsContrast(ratio, { level: 'AAA' });
  const large = meetsContrast(ratio, { largeText: true });
  if (aaa) return 'Passes AA and AAA';
  if (aa) return 'Passes AA body text';
  if (large) return 'Passes AA for large text or UI only';
  return 'Fails AA';
}

export default function AccessibilityScreen() {
  const [foreground, setForeground] = useState<string>(themes.dark.text);
  const [background, setBackground] = useState<string>(themes.dark.bg);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [target, setTarget] = useState('No audit yet');
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [failSave, setFailSave] = useState(false);
  const [saveReport, setSaveReport] = useState('No note saved yet.');
  const noteButton = useRef<HTMLButtonElement>(null);

  const ratio = useMemo(() => {
    try {
      return contrastRatio(foreground, background);
    } catch {
      return null;
    }
  }, [foreground, background]);

  function auditPage() {
    setTarget('This page');
    setViolations(audit(document));
  }

  function auditFixture() {
    const host = document.createElement('div');
    host.innerHTML = fixture;
    setTarget('Detached fixture');
    setViolations(audit(host));
  }

  async function saveNote() {
    const previous = saved;
    const next = draft;
    setNoteOpen(false);
    const result = await commitOptimistic({
      previous,
      next,
      apply: setSaved,
      write: () => new Promise((resolve, reject) => {
        setTimeout(() => {
          if (failSave) reject(new Error('The note service rejected the save.'));
          else resolve();
        }, 40);
      }),
    });
    setSaveReport(result === 'kept' ? `Saved "${next}".` : `The save failed. Restored "${previous}".`);
  }

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">Contract</p>
        <h2>Accessibility contract</h2>
        <p className="lede">
          Audit this page checks the page you are looking at. It looks for missing button names, skipped headings, more than one main landmark, and a few other mistakes. Zero means this page passed those checks.
          Audit broken fixture runs the same checks on a sample that is not on the page. That sample has six problems.
          The pair below is a <DocLink href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">contrast</DocLink> check. The route note is a <DocLink href="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/">dialog</DocLink>. This is a small set of rules. It is not a full WCAG audit, and it does not use a screen reader.
        </p>
      </header>
      <div className="grid-3">
        <Metric
          label="Contrast"
          value={ratio === null ? '—' : `${ratio.toFixed(2)}:1`}
          detail={ratio === null ? 'Enter two 6-digit hex colors' : describe(ratio)}
          tone={ratio !== null && meetsContrast(ratio) ? 'good' : 'poor'}
        />
        <Metric label="Audit target" value={violations.length ? String(violations.length) : '0'} detail={target} tone={violations.length ? 'poor' : 'neutral'} />
        <Metric label="Body AA bar" value="4.5:1" detail="3:1 for large text and UI" />
      </div>
      <Panel kicker="WCAG contrast" title="Check a pair">
        <div className="form-grid">
          <label className="platform-field">
            Foreground
            <input value={foreground} onChange={(event) => setForeground(event.target.value)} />
          </label>
          <label className="platform-field">
            Background
            <input value={background} onChange={(event) => setBackground(event.target.value)} />
          </label>
          <div className="platform-budget-track" style={{ background, height: 42 }} aria-hidden="true">
            <span style={{ color: foreground, fontFamily: 'var(--serif)', fontSize: '1.4rem', padding: '0.2rem 0.6rem', display: 'block' }}>
              Sample
            </span>
          </div>
        </div>
        <div className="button-row">
          <Button onClick={() => { setForeground(themes.dark.text); setBackground(themes.dark.bg); }}>Load dark pair</Button>
          <Button onClick={() => { setForeground(themes.light.text); setBackground(themes.light.bg); }}>Load light pair</Button>
        </div>
      </Panel>
      <Panel kicker="Widget" title="Route dialog">
        <p className="platform-muted">
          Open the dialog. Focus moves into the note field. Tab stays inside. Escape or Close returns focus to Open route dialog and leaves the saved note as it is.
          Save is an <DocLink href="https://react.dev/reference/react/useOptimistic">optimistic update</DocLink>: the note appears on this page immediately, and Fail this save brings the previous note back. This app is React 18, so the save and the rollback are written out here.
        </p>
        <p className="status-line" role="status">{saveReport}</p>
        <p>On the page: {saved || 'nothing yet'}.</p>
        <Button ref={noteButton} onClick={() => setNoteOpen(true)}>Open route dialog</Button>
        <Dialog open={noteOpen} title="Route note" onClose={() => setNoteOpen(false)}>
          <label className="platform-field">
            Note
            <input value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <label className="platform-field">
            <input type="checkbox" checked={failSave} onChange={(event) => setFailSave(event.target.checked)} />
            {' '}Fail this save
          </label>
          <div className="button-row">
            <Button variant="primary" onClick={() => void saveNote()}>Save note</Button>
            <Button onClick={() => setNoteOpen(false)}>Close</Button>
          </div>
        </Dialog>
      </Panel>
      <Panel kicker="Regression" title="Run the contract">
        <div className="button-row">
          <Button variant="primary" onClick={auditPage}>Audit this page</Button>
          <Button variant="danger" onClick={auditFixture}>Audit broken fixture</Button>
        </div>
        {violations.length === 0 ? <p className="platform-muted">{target === 'No audit yet' ? 'Run an audit to see violations.' : `${target} meets the in-repo contract.`}</p> : (
          violations.map((violation) => (
            <article key={`${violation.id}-${violation.selector}`} className="finding">
              <strong className="sev-error">{violation.id}</strong>
              <p className="platform-muted">{violation.message} <span className="platform-mono">{violation.selector}</span></p>
            </article>
          ))
        )}
      </Panel>
    </>
  );
}
