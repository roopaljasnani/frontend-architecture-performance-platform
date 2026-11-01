import { type ReactNode } from 'react';

function adrIdFromHref(href: string): string | null {
  const file = href.split('?')[0]?.split('/').pop() ?? href;
  const match = file.match(/^(\d{4})-/);
  return match?.[1] ?? null;
}

function inline(text: string, key: string, onOpen: (id: string) => void): ReactNode[] {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    if (match[1] && match[2]) {
      const id = adrIdFromHref(match[2]);
      if (id) {
        nodes.push(
          <a key={`${key}-${index}`} href={`#adr-${id}`} onClick={(event) => { event.preventDefault(); onOpen(id); }}>
            {match[1]}
          </a>,
        );
      } else {
        nodes.push(
          <a key={`${key}-${index}`} href={match[2]} target="_blank" rel="noreferrer">
            {match[1]}
          </a>,
        );
      }
    } else if (match[3]) {
      nodes.push(<strong key={`${key}-${index}`}>{match[3]}</strong>);
    } else if (match[4]) {
      nodes.push(<code key={`${key}-${index}`}>{match[4]}</code>);
    }
    cursor = start + match[0].length;
    index += 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Enough of Markdown for the ADR files: headings, lists, paragraphs, links, code. */
export function Markdown({ source, onOpen }: { source: string; onOpen: (id: string) => void }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: string[] = [];
  let index = 0;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    paragraph = [];
    blocks.push(<p key={`p-${index}`}>{inline(text, `p-${index}`, onOpen)}</p>);
    index += 1;
  }

  function flushList() {
    if (list.length === 0) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${index}`}>
        {items.map((item, itemIndex) => <li key={item}>{inline(item, `li-${index}-${itemIndex}`, onOpen)}</li>)}
      </ul>,
    );
    index += 1;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith('# ')) continue;
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(<h4 key={`h-${index}`}>{trimmed.slice(3)}</h4>);
      index += 1;
      continue;
    }
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();

  return <div className="adr-doc">{blocks}</div>;
}
