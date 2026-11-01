import { Button, Dialog, DocLink, Panel } from 'platform-ui';
import { useState } from 'react';
import { decisions } from '../decisions';
import { Markdown } from '../markdown';

const adrLoaders = import.meta.glob('../../../../docs/adr/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function loaderFor(id: string): (() => Promise<string>) | undefined {
  const entry = Object.entries(adrLoaders).find(([key]) => key.includes(`/${id}-`));
  return entry?.[1];
}

export default function DecisionsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [docError, setDocError] = useState('');
  const open = decisions.find((decision) => decision.id === openId);

  async function openDoc(id: string) {
    setOpenId(id);
    setDocError('');
    setBody('');
    const load = loaderFor(id);
    if (!load) {
      setDocError(`ADR ${id} is not in this build.`);
      return;
    }
    try {
      setBody(await load());
    } catch (error) {
      setDocError(error instanceof Error ? error.message : `ADR ${id} failed to load.`);
    }
  }

  return (
    <>
      <header className="screen-head">
        <p className="platform-kicker">ADR index</p>
        <h2>Architecture decisions</h2>
        <p className="lede">
          Each block is the short version of an <DocLink href="https://adr.github.io/">architecture decision record</DocLink>: what this app does, what we turned down, and the cost.
          Read ADR opens the full note, the same markdown file that lives in <span className="platform-mono">docs/adr</span>.
        </p>
      </header>
      {decisions.map((decision) => (
        <Panel key={decision.id} kicker={`ADR ${decision.id}`} title={decision.title}>
          <p>{decision.decision}</p>
          <p className="platform-kicker">Rejected</p>
          <ul>
            {decision.rejected.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="platform-muted">{decision.tradeoff}</p>
          <div className="button-row">
            <Button onClick={() => void openDoc(decision.id)}>Read ADR {decision.id}</Button>
          </div>
        </Panel>
      ))}
      <Dialog open={openId !== null} title={open?.title ?? 'Architecture decision'} wide onClose={() => setOpenId(null)}>
        {docError ? <p role="alert">{docError}</p> : null}
        {!docError && !body ? <p>Loading the note.</p> : null}
        {body ? <Markdown source={body} onOpen={(id) => void openDoc(id)} /> : null}
      </Dialog>
    </>
  );
}
