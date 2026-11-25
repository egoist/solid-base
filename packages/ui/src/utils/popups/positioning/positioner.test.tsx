import { describe, expect, it } from 'vitest';
import { createRoot, flush, Show, createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import {
  BasePopupStore,
  createInitialPopupStoreState,
  createPopupStoreContext,
  popupStoreSelectors,
  type PopupOpenChangeEventDetails,
  type PopupStoreContext,
  type PopupStoreState,
} from '../store';
import type { AdaptiveOriginMiddleware } from './adaptiveOriginConstants';
import {
  createPopupPositioner,
  type PopupPositionerProps,
  type PopupPositionerState,
} from '../popupPositioner';

type TestState = PopupStoreState<unknown> & {
  instantType: string | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

const selectors = {
  ...popupStoreSelectors,
  instantType: (state: TestState) => state.instantType,
  adaptiveOrigin: (state: TestState) => state.adaptiveOrigin,
};

class TestStore extends BasePopupStore<
  TestState,
  PopupStoreContext<PopupOpenChangeEventDetails>,
  typeof selectors,
  PopupOpenChangeEventDetails
> {}

function createStore(initial: Partial<TestState>) {
  return createRoot(
    () =>
      new TestStore(
        {
          ...createInitialPopupStoreState<unknown>(),
          instantType: undefined,
          adaptiveOrigin: undefined,
          ...initial,
        },
        createPopupStoreContext(),
        selectors,
      ),
  );
}

function TestPositioner(props: PopupPositionerProps<PopupPositionerState> & { store: TestStore }) {
  // eslint-disable-next-line solid/reactivity
  const { element } = createPopupPositioner(props.store, props, { keepMounted: false });
  return element;
}

async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  flush();
}

describe('createPopupPositioner', () => {
  it('renders the positioner with the shared state and registers it in the store', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const store = createStore({ open: true, mounted: true, activeTriggerElement: trigger });

    let userRef: HTMLElement | undefined;
    const [show, setShow] = createSignal(true);
    render(() => (
      <Show when={show()}>
        <TestPositioner
          store={store}
          side="top"
          align="start"
          class="positioner"
          data-testid="positioner"
          ref={(element) => {
            userRef = element;
          }}
        />
      </Show>
    ));

    const positioner = screen.getByTestId('positioner');
    expect(userRef).toBe(positioner);
    expect(store.state.positionerElement).toBe(positioner);
    expect(positioner).toHaveAttribute('role', 'presentation');
    expect(positioner).toHaveClass('positioner');
    expect(positioner).toHaveAttribute('data-open', '');
    expect(positioner).toHaveAttribute('data-side', 'top');
    expect(positioner).toHaveAttribute('data-align', 'start');
    expect(positioner).not.toHaveAttribute('hidden');
    // Positioning props aren't forwarded to the element.
    expect(positioner).not.toHaveAttribute('side');
    expect(positioner).not.toHaveAttribute('align');
    expect(positioner.style.getPropertyValue('--available-width')).toBe('100vw');

    await flushMicrotasks();

    expect(positioner.style.position).toBe('absolute');
    expect(positioner.style.transform).toMatch(/^translate\(/);

    setShow(false);
    flush();

    expect(store.state.positionerElement).toBe(null);
    trigger.remove();
  });

  it('reflects closed, unmounted and instant states', () => {
    const store = createStore({ open: false, mounted: true, instantType: 'click' });

    render(() => <TestPositioner store={store} data-testid="positioner" />);
    const positioner = screen.getByTestId('positioner');

    expect(positioner).toHaveAttribute('data-closed', '');
    expect(positioner).toHaveAttribute('data-instant', 'click');
    // A closed positioner ignores pointer events.
    expect(positioner.style.pointerEvents).toBe('none');

    store.set('mounted', false);
    flush();

    expect(positioner).toHaveAttribute('hidden');
  });

  it('disables transitions while the popup is starting to open', () => {
    const store = createStore({ open: true, mounted: true, transitionStatus: 'starting' });

    render(() => <TestPositioner store={store} data-testid="positioner" />);
    const positioner = screen.getByTestId('positioner');

    expect(positioner.style.transition).toBe('none');
    expect(positioner.style.pointerEvents).toBe('');

    store.set('transitionStatus', undefined);
    flush();

    expect(positioner.style.transition).toBe('');
  });
});
