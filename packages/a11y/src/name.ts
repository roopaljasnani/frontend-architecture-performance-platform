function escapeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function searchRoot(element: Element): ParentNode {
  const root = element.getRootNode();
  if (root instanceof Document || root instanceof Element || root instanceof DocumentFragment) return root;
  return element.ownerDocument;
}

function elementById(element: Element, id: string): Element | null {
  const root = searchRoot(element);
  if (root instanceof Document) return root.getElementById(id);
  if (root instanceof Element && root.id === id) return root;
  return root.querySelector(`#${escapeId(id)}`);
}

export function accessibleName(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (collapse(aria)) return collapse(aria);

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
        .map((id) => elementById(element, id)?.textContent ?? '')
      .join(' ');
    if (collapse(text)) return collapse(text);
  }

  if (element.tagName === 'IMG') return collapse(element.getAttribute('alt'));

  const id = element.getAttribute('id');
  if (id) {
    const label = searchRoot(element).querySelector(`label[for="${escapeId(id)}"]`);
    if (collapse(label?.textContent)) return collapse(label?.textContent);
  }

  const wrappingLabel = element.closest('label');
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea, button').forEach((node) => node.remove());
    if (collapse(clone.textContent)) return collapse(clone.textContent);
  }

  if (element.tagName !== 'INPUT' && element.tagName !== 'SELECT' && element.tagName !== 'TEXTAREA') {
    const text = collapse(element.textContent);
    if (text) return text;
  }

  const value = element.getAttribute('value');
  if ((element.getAttribute('type') === 'submit' || element.getAttribute('type') === 'button' || element.getAttribute('type') === 'reset') && collapse(value)) {
    return collapse(value);
  }

  return collapse(element.getAttribute('title'));
}
