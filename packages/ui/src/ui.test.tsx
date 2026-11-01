import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BudgetBar, Button, Dialog, WindowedList } from './components';
import { visibleRange } from './window';

describe('visibleRange', () => {
  it('windows a long list with overscan', () => {
    expect(visibleRange({ itemCount: 1000, rowHeight: 20, viewportHeight: 200, scrollTop: 0 })).toMatchObject({
      start: 0,
      end: 18,
      totalHeight: 20000,
    });
    expect(visibleRange({ itemCount: 1000, rowHeight: 20, viewportHeight: 200, scrollTop: 500 })).toMatchObject({
      start: 21,
      end: 39,
      offsetY: 420,
    });
  });
});

describe('design system controls', () => {
  it('names buttons and exposes budget meters', () => {
    render(
      <>
        <Button variant="primary">Save budget</Button>
        <BudgetBar label="Checkout JavaScript" value={188000} max={160000} format={(value) => `${value} B`} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save budget' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Checkout JavaScript' })).toHaveProperty('ariaValueNow');
  });

  it('mounts only the visible window of a long collection', () => {
    const items = Array.from({ length: 4000 }, (_, index) => `route-${index}`);
    render(
      <WindowedList
        items={items}
        rowHeight={28}
        height={140}
        getKey={(item) => item}
        renderRow={(item) => item}
      />,
    );
    expect(screen.getByText('route-0')).toBeTruthy();
    expect(screen.queryByText('route-80')).toBeNull();
    fireEvent.scroll(document.querySelector('.platform-window')!, { target: { scrollTop: 2240 } });
  });

  it('keeps tab order inside a dialog and returns focus on escape', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open route dialog</Button>
          <Dialog open={open} title="Route note" onClose={() => setOpen(false)}>
            <label>
              Note
              <input />
            </label>
            <Button onClick={() => setOpen(false)}>Save note</Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open route dialog' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Route note' }).contains(document.activeElement)).toBe(true);
    screen.getByRole('button', { name: 'Close' }).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Note' }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
