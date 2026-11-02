// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SidebarDrawer, useSidebarDrawer } from './SidebarDrawer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A controllable matchMedia: the drawer closes itself when the window grows past md.
let mqMatches = false;
let mqListeners: Array<() => void> = [];
window.matchMedia = ((query: string) => ({
  get matches() { return mqMatches; },
  media: query,
  addEventListener: (_: string, cb: () => void) => { mqListeners.push(cb); },
  removeEventListener: (_: string, cb: () => void) => { mqListeners = mqListeners.filter((l) => l !== cb); },
  addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

// The shape both pages use: the column from md up, a md:hidden toggle, the same list in the drawer.
function Page({ picked }: { picked: string[] }) {
  const drawer = useSidebarDrawer('test-drawer');
  const list = (onPick: (id: string) => void) => (
    <ul>
      {['1', '2'].map((id) => (
        <li key={id}><button type="button" onClick={() => onPick(id)}>Lesson {id}</button></li>
      ))}
    </ul>
  );
  return (
    <div>
      <div className="hidden md:block" data-testid="column">{list((id) => picked.push(id))}</div>
      <button type="button" className="md:hidden" aria-label="Lessons" data-testid="toggle" {...drawer.toggleProps}>≡</button>
      <SidebarDrawer {...drawer.drawerProps} label="Course lessons" closeLabel="Close">
        {list((id) => { drawer.close(); picked.push(id); })}
      </SidebarDrawer>
    </div>
  );
}

let root: Root;
let host: HTMLDivElement;
let picked: string[];
const q = (sel: string) => host.querySelector(sel) as HTMLElement | null;
const toggle = () => q('[data-testid="toggle"]')!;
const dialog = () => q('[role="dialog"]');
const click = (el: HTMLElement) => act(() => { el.click(); });
const key = (k: string, opts: KeyboardEventInit = {}) => act(() => {
  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));
});

beforeEach(() => {
  mqMatches = false;
  mqListeners = [];
  picked = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Page picked={picked} />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('SidebarDrawer', () => {
  it('starts closed: the column is a md+ block, the toggle is phone-only', () => {
    expect(dialog()).toBeNull();
    expect(q('[data-testid="column"]')!.className).toContain('hidden md:block');
    expect(toggle().className).toContain('md:hidden');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('the toggle opens a labelled modal drawer, phone-only, with focus inside it', () => {
    toggle().focus();
    click(toggle());
    const d = dialog()!;
    expect(d).not.toBeNull();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBe('Course lessons');
    expect(d.id).toBe('test-drawer');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-controls')).toBe('test-drawer');
    expect(q('[data-testid="sidebar-drawer"]')!.className).toContain('md:hidden');
    expect(d.contains(document.activeElement)).toBe(true);
    expect(d.textContent).toContain('Lesson 2');
  });

  it('the toggle closes it again', () => {
    click(toggle());
    click(toggle());
    expect(dialog()).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('Escape closes it and focus goes back to the toggle', () => {
    toggle().focus();
    click(toggle());
    key('Escape');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it('an Escape already handled by a layer inside the drawer leaves it open', () => {
    click(toggle());
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      e.preventDefault();
      dialog()!.dispatchEvent(e);
    });
    expect(dialog()).not.toBeNull();
  });

  it('the overlay and the close button close it', () => {
    click(toggle());
    click(q('[data-testid="sidebar-drawer-overlay"]')!);
    expect(dialog()).toBeNull();
    click(toggle());
    click(q('[role="dialog"] button[aria-label="Close"]')!);
    expect(dialog()).toBeNull();
  });

  it('picking an item in the drawer closes it', () => {
    click(toggle());
    const item = Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent === 'Lesson 2')!;
    click(item);
    expect(picked).toEqual(['2']);
    expect(dialog()).toBeNull();
  });

  it('Tab stays inside the open drawer', () => {
    click(toggle());
    const buttons = Array.from(dialog()!.querySelectorAll('button'));
    const last = buttons[buttons.length - 1];
    last.focus();
    key('Tab');
    expect(document.activeElement).toBe(buttons[0]);
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes when the window grows to md, where the column is back', () => {
    click(toggle());
    mqMatches = true;
    act(() => mqListeners.forEach((l) => l()));
    expect(dialog()).toBeNull();
  });
});
