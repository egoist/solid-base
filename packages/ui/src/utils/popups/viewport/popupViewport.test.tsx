import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { expect, describe, it } from 'vitest';
import { renderElement } from '../../../internals/renderElement';
import { ReactiveStore } from '../reactiveStore';
import { adaptiveOrigin } from '../positioning/adaptiveOriginMiddleware';
import {
  calculateRelativePosition,
  createPopupViewport,
  getActivationDirection,
  popupViewportStateMapping,
} from './popupViewport';
import type { Offset } from './popupViewport';

describe('getActivationDirection', () => {
  it('returns undefined without an offset', () => {
    expect(getActivationDirection(null)).toBe(undefined);
  });

  // The value is a space-separated token list (matched with `~=` selectors), so compare tokens
  // rather than the exact string.
  it.each([
    { offset: { horizontal: 100, vertical: 100 }, expected: ['right', 'down'] },
    { offset: { horizontal: -100, vertical: -100 }, expected: ['left', 'up'] },
    { offset: { horizontal: 100, vertical: -100 }, expected: ['right', 'up'] },
    { offset: { horizontal: -100, vertical: 100 }, expected: ['left', 'down'] },
    // An axis within tolerance contributes no token.
    { offset: { horizontal: 100, vertical: 0 }, expected: ['right'] },
    { offset: { horizontal: -100, vertical: 0 }, expected: ['left'] },
    { offset: { horizontal: 0, vertical: 100 }, expected: ['down'] },
    { offset: { horizontal: 0, vertical: -100 }, expected: ['up'] },
    { offset: { horizontal: 0, vertical: 0 }, expected: [] },
    // The tolerance is 5px and exclusive.
    { offset: { horizontal: 5, vertical: 5 }, expected: [] },
    { offset: { horizontal: -5, vertical: -5 }, expected: [] },
    { offset: { horizontal: 5.5, vertical: -5.5 }, expected: ['right', 'up'] },
    { offset: { horizontal: 6, vertical: 6 }, expected: ['right', 'down'] },
    { offset: { horizontal: -6, vertical: -6 }, expected: ['left', 'up'] },
  ] satisfies Array<{ offset: Offset; expected: string[] }>)(
    'returns [$expected] for $offset.horizontal, $offset.vertical',
    ({ offset, expected }) => {
      expect(getActivationDirection(offset)?.split(' ').filter(Boolean)).toEqual(expected);
    },
  );
});

function createElementWithRect(left: number, top: number, width: number, height: number) {
  const element = document.createElement('button');
  const rect = {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
  element.getBoundingClientRect = () => rect;
  return element;
}

describe('calculateRelativePosition', () => {
  it.each([
    {
      name: 'measures from the previous trigger to the new one',
      from: [0, 0, 100, 50],
      to: [200, 100, 100, 50],
      expected: { horizontal: 200, vertical: 100 },
    },
    {
      name: 'is negative when the new trigger is up and to the left',
      from: [200, 100, 100, 50],
      to: [0, 0, 100, 50],
      expected: { horizontal: -200, vertical: -100 },
    },
    {
      // Centers (50, 25) -> (20, 5); the top-left corners would give (10, 0).
      name: 'compares centers, not corners, of differently sized triggers',
      from: [0, 0, 100, 50],
      to: [10, 0, 20, 10],
      expected: { horizontal: -30, vertical: -20 },
    },
    {
      name: 'is zero for triggers that share a center',
      from: [0, 0, 100, 100],
      to: [25, 25, 50, 50],
      expected: { horizontal: 0, vertical: 0 },
    },
  ] satisfies Array<{
    name: string;
    from: [number, number, number, number];
    to: [number, number, number, number];
    expected: Offset;
  }>)('$name', ({ from, to, expected }) => {
    expect(
      calculateRelativePosition(createElementWithRect(...from), createElementWithRect(...to)),
    ).toEqual(expected);
  });
});

describe('createPopupViewport', () => {
  interface TestState {
    open: boolean;
    mounted: boolean;
    activeTriggerElement: Element | null;
    activeTriggerId: string | null;
    payload: string | undefined;
    popupElement: HTMLElement | null;
    positionerElement: HTMLElement | null;
    adaptiveOrigin: unknown;
  }

  function setup() {
    const trigger1 = createElementWithRect(0, 0, 100, 50);
    trigger1.id = 't1';
    const trigger2 = createElementWithRect(200, 100, 100, 50);
    trigger2.id = 't2';
    document.body.append(trigger1, trigger2);

    const store = new ReactiveStore<TestState>(
      {
        open: true,
        mounted: true,
        activeTriggerElement: trigger1,
        activeTriggerId: 't1',
        payload: 'one',
        popupElement: null,
        positionerElement: null,
        adaptiveOrigin: undefined,
      },
      {},
    );

    function Viewport(props: { children?: JSX.Element }) {
      const viewport = createPopupViewport({
        store,
        side: 'bottom',
        get children() {
          return props.children;
        },
      });
      return renderElement(
        'div',
        {},
        {
          state: viewport.state,
          props: [{ 'data-testid': 'viewport' }, { children: viewport.children }],
          stateAttributesMapping: popupViewportStateMapping,
        },
      );
    }

    const result = render(() => (
      <Viewport>
        <span data-testid="content">{store.select('payload')}</span>
      </Viewport>
    ));

    function getCurrent() {
      return screen.getByTestId('viewport').querySelector<HTMLElement>('[data-current]')!;
    }

    function getPrevious() {
      return screen.getByTestId('viewport').querySelector<HTMLElement>('[data-previous]');
    }

    return { store, trigger1, trigger2, getCurrent, getPrevious, ...result };
  }

  it('renders the children in a current container', () => {
    const { store, getCurrent, getPrevious, unmount } = setup();

    const viewport = screen.getByTestId('viewport');
    expect(getCurrent()).toHaveTextContent('one');
    expect(getCurrent().parentElement).toBe(viewport);
    expect(getPrevious()).toBe(null);
    expect(viewport).not.toHaveAttribute('data-transitioning');
    expect(viewport).not.toHaveAttribute('data-activation-direction');
    expect(store.state.adaptiveOrigin).toBe(adaptiveOrigin);

    unmount();
    expect(store.state.adaptiveOrigin).toBe(undefined);
  });

  it('keeps the previous content while the active trigger changes', async () => {
    const { store, trigger2, getCurrent, getPrevious } = setup();
    const initialCurrent = getCurrent();

    store.update({ activeTriggerElement: trigger2, activeTriggerId: 't2', payload: 'two' });
    flush();

    const viewport = screen.getByTestId('viewport');
    const previous = getPrevious()!;
    expect(previous).not.toBe(null);
    // The snapshot shows the content as it was before the change.
    expect(previous).toHaveTextContent('one');
    expect(previous).toHaveAttribute('inert');
    expect(previous.style.position).toBe('absolute');
    expect(previous.nextElementSibling).toBe(getCurrent());

    // The current content remounted with the new trigger.
    expect(getCurrent()).not.toBe(initialCurrent);
    expect(getCurrent()).toHaveTextContent('two');
    expect(getCurrent()).toHaveAttribute('data-starting-style');
    expect(previous).not.toHaveAttribute('data-ending-style');

    expect(viewport).toHaveAttribute('data-transitioning');
    expect(viewport.getAttribute('data-activation-direction')?.split(' ')).toEqual([
      'right',
      'down',
    ]);

    // The starting style is removed on the next frame; the previous content then leaves once the
    // current container's animations have finished.
    await waitFor(() => {
      expect(getPrevious()).toBe(null);
    });
    expect(getCurrent()).not.toHaveAttribute('data-starting-style');
    expect(getCurrent()).toHaveTextContent('two');
    expect(viewport).not.toHaveAttribute('data-transitioning');
    // The activation direction stays until the next trigger change.
    expect(viewport).toHaveAttribute('data-activation-direction');
  });

  it('marks the previous content as ending once the starting style is removed', async () => {
    const { store, trigger2, getCurrent, getPrevious } = setup();
    // Keep the transition running: animations never finish.
    const pending = new Promise<void>(() => {});
    const animation = { finished: pending, effect: { getTiming: () => ({ iterations: 1 }) } };
    const getAnimations = () => [animation as unknown as Animation];

    store.update({ activeTriggerElement: trigger2, activeTriggerId: 't2', payload: 'two' });
    flush();
    getCurrent().getAnimations = getAnimations;

    await waitFor(() => {
      expect(getCurrent()).not.toHaveAttribute('data-starting-style');
    });
    expect(getPrevious()).toHaveAttribute('data-ending-style');
    expect(getPrevious()).toHaveTextContent('one');
  });

  it('remounts the current content again when the payload arrives later', async () => {
    const { store, trigger2, getCurrent, getPrevious } = setup();
    const initialCurrent = getCurrent();

    store.update({ activeTriggerElement: trigger2, activeTriggerId: 't2' });
    flush();
    const switchedCurrent = getCurrent();
    expect(switchedCurrent).not.toBe(initialCurrent);
    expect(getPrevious()).toHaveTextContent('one');

    store.set('payload', 'two');
    flush();
    expect(getCurrent()).not.toBe(switchedCurrent);
    expect(getCurrent()).toHaveTextContent('two');
    // The previous content is still the one from before the trigger change.
    expect(getPrevious()).toHaveTextContent('one');

    await waitFor(() => {
      expect(getPrevious()).toBe(null);
    });
  });

  it('does not transition when the trigger changes while closed', () => {
    const { store, trigger2, getPrevious } = setup();

    store.update({ open: false });
    flush();
    store.update({ activeTriggerElement: trigger2, activeTriggerId: 't2', payload: 'two' });
    flush();
    store.update({ open: true });
    flush();

    expect(getPrevious()).toBe(null);
    expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
    expect(screen.getByTestId('content')).toHaveTextContent('two');
  });
});
