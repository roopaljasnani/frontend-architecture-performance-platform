import { accessibleName } from './name';

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface Violation {
  id: string;
  impact: Impact;
  message: string;
  selector: string;
}

function selectorFor(element: Element): string {
  const id = element.getAttribute('id');
  if (id) return `${element.tagName.toLowerCase()}#${id}`;
  const parent = element.parentElement;
  if (!parent) return element.tagName.toLowerCase();
  const index = [...parent.children].indexOf(element) + 1;
  return `${selectorFor(parent)} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
}

function push(violations: Violation[], element: Element, violation: Omit<Violation, 'selector'>): void {
  violations.push({ ...violation, selector: selectorFor(element) });
}

/**
 * Contract checks the design system is able to break on its own.
 * This is not a WCAG audit and it does not replace axe-core or a screen reader pass.
 */
export function audit(root: ParentNode): Violation[] {
  const violations: Violation[] = [];
  const scope: ParentNode = root;
  const documentRef = root instanceof Document ? root : document;

  const buttons = scope.querySelectorAll('button, [role="button"]');
  buttons.forEach((element) => {
    if (!accessibleName(element)) {
      push(violations, element, {
        id: 'button-name',
        impact: 'critical',
        message: 'Buttons need an accessible name.',
      });
    }
  });

  scope.querySelectorAll('a[href]').forEach((element) => {
    if (!accessibleName(element)) {
      push(violations, element, {
        id: 'link-name',
        impact: 'serious',
        message: 'Links need an accessible name.',
      });
    }
  });

  scope.querySelectorAll('img').forEach((element) => {
    if (!element.hasAttribute('alt')) {
      push(violations, element, {
        id: 'image-alt',
        impact: 'critical',
        message: 'Images need an alt attribute. Use an empty alt when the image is decorative.',
      });
    }
  });

  scope.querySelectorAll('input, select, textarea').forEach((element) => {
    const type = element.getAttribute('type');
    if (type === 'hidden') return;
    if ((type === 'submit' || type === 'button' || type === 'reset') && accessibleName(element)) return;
    if (!accessibleName(element)) {
      push(violations, element, {
        id: 'control-name',
        impact: 'critical',
        message: 'Form controls need a label, aria-label, or aria-labelledby.',
      });
    }
  });

  const headings = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName[1]);
    if (level > previous + 1) {
      push(violations, heading, {
        id: 'heading-order',
        impact: 'moderate',
        message: `Heading level ${level} skips level ${previous + 1}.`,
      });
    }
    previous = level;
  }

  const mains = scope.querySelectorAll('main, [role="main"]');
  if (mains.length === 0) {
    const host = root instanceof Element ? root : documentRef.documentElement;
    push(violations, host, {
      id: 'landmark-main',
      impact: 'moderate',
      message: 'The view needs one main landmark.',
    });
  } else if (mains.length > 1) {
    mains.forEach((element) => {
      push(violations, element, {
        id: 'landmark-main',
        impact: 'moderate',
        message: 'The view has more than one main landmark.',
      });
    });
  }

  scope.querySelectorAll('[tabindex]').forEach((element) => {
    const value = Number(element.getAttribute('tabindex'));
    if (value > 0) {
      push(violations, element, {
        id: 'positive-tabindex',
        impact: 'serious',
        message: 'tabindex greater than 0 fights the natural tab order.',
      });
    }
  });

  const seen = new Map<string, Element>();
  scope.querySelectorAll('[id]').forEach((element) => {
    const id = element.getAttribute('id');
    if (!id) return;
    const previousElement = seen.get(id);
    if (previousElement) {
      push(violations, element, {
        id: 'duplicate-id',
        impact: 'serious',
        message: `Duplicate id "${id}" breaks labels and fragment navigation.`,
      });
    } else {
      seen.set(id, element);
    }
  });

  return violations;
}
