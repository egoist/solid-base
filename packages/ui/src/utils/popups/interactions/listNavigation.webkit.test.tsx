import { For, Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createTestFloating, getInteractionProps, getItemInteractionProps } from '../testUtils';
import { createClick } from './click';
import { createListNavigation } from './listNavigation';
import { cleanupRef, getFloatingTestProps } from './__fixtures__/helpers';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

function App() {
  const [open, setOpen] = createSignal(false);
  const listRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null);
  const { store, refs } = createTestFloating({
    open,
    onOpenChange: (value) => setOpen(value),
  });
  const interactions = [
    createClick(store),
    createListNavigation(store, {
      listRef,
      get activeIndex() {
        return activeIndex();
      },
      onNavigate: (index) => setActiveIndex(index),
    }),
  ];

  return (
    <>
      <button {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })} />
      <Show when={open()}>
        <div
          role="menu"
          {...getFloatingTestProps(interactions, { ref: cleanupRef(refs.setFloating) })}
        >
          <ul>
            <For each={['one', 'two', 'three']} keyed={false}>
              {(string, index) => (
                <li
                  data-testid={`item-${index}`}
                  aria-selected={activeIndex() === index ? 'true' : 'false'}
                  tabindex={-1}
                  {...getItemInteractionProps(interactions, {
                    ref: cleanupRef<HTMLElement>((node) => {
                      listRef.current[index] = node;
                    }),
                  })}
                >
                  {string()}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </>
  );
}

function fire(dispatch: () => void) {
  dispatch();
  flush();
}

describe('createListNavigation (WebKit)', () => {
  it('ignores stationary mousemove events fired when the list scrolls beneath the pointer', async () => {
    render(() => <App />);

    fire(() => fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' }));
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // WebKit fires a `mousemove` event with zero movement deltas on the item
    // that moves under the stationary pointer during a keyboard-driven scroll.
    fire(() => fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 0, movementY: 0 }));
    expect(screen.getByTestId('item-0')).toHaveFocus();
    expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'false');

    // An actual pointer movement still moves the highlight.
    fire(() => fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 }));
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
    expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps keyboard modality when a stationary pointermove fires on the floating element', async () => {
    render(() => <App />);

    fire(() => fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' }));
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // The stationary sequence bubbles a `pointermove` through the floating
    // element before the item receives the `mousemove`.
    fire(() =>
      fireEvent.pointerMove(screen.getByRole('menu'), {
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
      }),
    );
    fire(() => fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 0, movementY: 0 }));
    expect(screen.getByTestId('item-0')).toHaveFocus();

    // Scrolling can also move the active item out from under the pointer. This
    // must not reset the keyboard highlight as though the pointer had left it.
    fire(() =>
      fireEvent.pointerLeave(screen.getByTestId('item-0'), {
        pointerType: 'mouse',
        relatedTarget: screen.getByRole('menu'),
      }),
    );
    expect(screen.getByTestId('item-0')).toHaveAttribute('aria-selected', 'true');
  });
});
