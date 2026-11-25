import { For, Show, createSignal } from 'solid-js';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { createTestFloating, getInteractionProps, getItemInteractionProps } from '../../testUtils';
import { FloatingFocusManager } from '../../focus/FloatingFocusManager';
import { createClick } from '../click';
import { createDismiss } from '../dismiss';
import { createListNavigation } from '../listNavigation';
import { gridNavigationWithColumns } from './gridNavigationWithColumns';
import { cleanupRef, getFloatingTestProps } from './helpers';

const grid = gridNavigationWithColumns(5);

const disabledIndices = [0, 1, 2, 3, 4, 5, 6, 7, 10, 15, 45, 48];

interface Props {
  orientation?: 'horizontal' | 'both';
  loopFocus?: boolean;
}

/**
 * A 5-column grid of 49 options with disabled items (port of Floating UI's `Grid` fixture).
 * @internal
 */
export function Main(props: Props) {
  const [open, setOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);

  const listRef: RefObject<Array<HTMLElement | null>> = { current: [] };

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
      get orientation() {
        return props.orientation ?? 'horizontal';
      },
      get loopFocus() {
        return props.loopFocus ?? false;
      },
      openOnArrowKeyDown: false,
      disabledIndices,
      grid,
    }),
    createDismiss(store),
  ];

  return (
    <>
      <h1>Grid</h1>
      <div>
        <button
          type="button"
          {...getInteractionProps(interactions, 'reference', { ref: refs.setReference })}
        >
          Reference
        </button>
        <Show when={open()}>
          <FloatingFocusManager store={store}>
            <div
              role="menu"
              data-testid="floating"
              style={{
                display: 'grid',
                'grid-template-columns': '100px 100px 100px 100px 100px',
                'z-index': 999,
              }}
              {...getFloatingTestProps(interactions, {
                ref: cleanupRef(refs.setFloating),
              })}
            >
              <For each={Array.from({ length: 49 }, (_, index) => index)}>
                {(index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIndex() === index ? 'true' : 'false'}
                    tabindex={activeIndex() === index ? 0 : -1}
                    disabled={disabledIndices.includes(index)}
                    {...getItemInteractionProps(interactions, {
                      ref: cleanupRef<HTMLElement>((node) => {
                        listRef.current[index] = node;
                      }),
                    })}
                  >
                    Item {index}
                  </button>
                )}
              </For>
            </div>
          </FloatingFocusManager>
        </Show>
      </div>
    </>
  );
}
