import { For, Show, createSignal, flush, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from '..';
import { Dialog } from '../../dialog';
import { DirectionProvider } from '../../direction-provider';
import { REASONS } from '../../internals/reasons';
import { popupConformanceTests } from '../../popover/anchoredPopupTestUtils';
import {
  ContainedTriggerMenu,
  DetachedTriggerMenu,
  act,
  flushMicrotasks,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../test-utils';

/**
 * Upstream's async `render` lets the focus manager move focus into an initially open popup
 * before the test continues; wait for it so it doesn't steal focus from the tested item.
 */
async function waitForInitialFocus() {
  await waitFor(() => {
    expect(screen.getByTestId('menu')).toHaveFocus();
  });
}

describe('<Menu.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('closing before the popup attaches', () => {
    it('unmounts the popup when a layout effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(true);
        onSettled(() => {
          setOpen(false);
        });
        return (
          <Menu.Root
            open={open()}
            onOpenChange={(next) => setOpen(next)}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Apple</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      renderWithUser(() => <App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('menu', { hidden: true })).toBe(null);
    });

    it('unmounts the popup when a layout effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Menu.Root
            open={open()}
            onOpenChange={(next) => {
              setOpen(next);
              if (next) {
                // Close again once the open has committed.
                onSettled(() => {
                  setOpen(false);
                });
              }
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Apple</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('menu', { hidden: true })).toBe(null);
    });
  });

  it('returns focus on Escape after a controlled root ignores a Shift+Tab close', async () => {
    function TestMenu() {
      const [open, setOpen] = createSignal(false);

      return (
        <Menu.Root
          modal={false}
          open={open()}
          onOpenChange={(nextOpen, details) => {
            if (details.reason !== REASONS.focusOut) {
              setOpen(nextOpen);
            }
          }}
        >
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    const { user } = renderWithUser(() => <TestMenu />);
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveFocus();
    });

    await user.tab({ shift: true });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('menuitem')).toHaveFocus();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    expect(trigger).toHaveFocus();
  });

  it('keeps focus in the menu when a Shift+Tab close is canceled', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root
        defaultOpen
        onOpenChange={(open, details) => {
          if (!open) {
            details.cancel();
          }
        }}
      >
        <Menu.Trigger>Toggle</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const menu = screen.getByRole('menu');
    await waitFor(() => {
      expect(menu).toHaveFocus();
    });

    await user.tab({ shift: true });

    expect(menu).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('aria-expanded', 'true');
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        <Menu.Trigger {...props.trigger}>Open menu</Menu.Trigger>
        <Menu.Portal {...props.portal}>
          <Menu.Positioner>
            <Menu.Popup {...props.popup}>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    triggerMouseAction: 'click',
    expectedPopupRole: 'menu',
  });

  describe('hover opening', () => {
    // Requires real layout (measures the gap between the trigger and the popup).
    it.skip('stays open while the pointer crosses the gap from the trigger to the popup', () => {});
  });

  describe('opening', () => {
    function TestMenu(props: { children?: JSX.Element }) {
      return (
        <Menu.Root>
          <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {props.children ?? [<Menu.Item>One</Menu.Item>, <Menu.Item>Two</Menu.Item>]}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    it('highlights the first item when the items render a microtask after a keyboard opening', async () => {
      function RenderNextMicrotask(props: { children: JSX.Element }) {
        const [ready, setReady] = createSignal(false);
        onSettled(() => {
          queueMicrotask(() => {
            setReady(true);
            flush();
          });
        });
        return <Show when={ready()}>{props.children}</Show>;
      }

      const { user } = renderWithUser(() => (
        <TestMenu>
          <RenderNextMicrotask>
            <Menu.Item>One</Menu.Item>
            <Menu.Item>Two</Menu.Item>
          </RenderNextMicrotask>
        </TestMenu>
      ));

      await act(async () => {
        screen.getByTestId('trigger').focus();
      });
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });
    });

    // Browser-only upstream: screen reader presses rely on real pointer events (`width`,
    // `height`, `pressure`), which jsdom's PointerEvent doesn't carry.
    it.skip('moves focus to the first item after a screen reader a zero-size press', () => {});
    it.skip("moves focus to the first item after a screen reader Chrome's 1x1 pressureless press", () => {});
    it.skip(
      'returns focus to the trigger from an alert dialog opened by an item after a screen reader press',
      () => {},
    );
    it.skip('keeps focus in the popup when a screen reader press moves it to another trigger', () => {});
  });

  // Upstream `popupListConformanceTests` (itemRole 'menuitem', DOM focus, not selectable, the list
  // wraps at its ends).
  describe('Popup list conformance', () => {
    const ITEMS = Array.from({ length: 12 }, (_, index) => `Item ${index}`);
    const ITEM_HEIGHT = 30;

    interface RenderListOptions {
      root?: Menu.Root.Props | undefined;
      items?: readonly string[] | undefined;
      disabledItems?: readonly string[] | undefined;
      onItemClick?: ((event: MouseEvent & { currentTarget: HTMLElement }) => void) | undefined;
      onOutsideClick?: (() => void) | undefined;
      wrap?: ((node: () => JSX.Element) => JSX.Element) | undefined;
    }

    function ListMenu(props: RenderListOptions) {
      const items = () => props.items ?? ITEMS;
      const disabledItems = () => props.disabledItems ?? [];
      return (
        <Menu.Root {...props.root}>
          <Menu.Trigger data-testid="trigger">Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup">
                <Menu.List
                  data-testid="scroller"
                  style={{ height: '100px', 'max-height': 'none', 'overflow-y': 'auto', padding: '0' }}
                >
                  <For each={items()}>
                    {(item) => (
                      <Menu.Item
                        disabled={disabledItems().includes(item)}
                        style={{ height: `${ITEM_HEIGHT}px`, 'box-sizing': 'border-box', margin: '0' }}
                        onClick={(event: MouseEvent & { currentTarget: HTMLElement }) =>
                          props.onItemClick?.(event)
                        }
                      >
                        <span>{item}</span>
                      </Menu.Item>
                    )}
                  </For>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    function renderList(options: RenderListOptions = {}) {
      const content = () => (
        <div>
          <button type="button" data-testid="before">
            Before
          </button>
          <ListMenu {...options} />
          <button type="button" data-testid="after" onClick={() => options.onOutsideClick?.()}>
            After
          </button>
        </div>
      );
      return renderWithUser(() => (options.wrap ? options.wrap(content) : content()));
    }

    type User = ReturnType<typeof renderList>['user'];

    function getTrigger() {
      return screen.getByTestId('trigger');
    }

    function getItem(index: number) {
      return screen.getByRole('menuitem', { name: ITEMS[index] });
    }

    function getHighlightedIndex() {
      const highlighted = screen
        .queryAllByRole('menuitem')
        .filter((item) => item.hasAttribute('data-highlighted'));
      if (highlighted.length > 1) {
        throw new Error(`Popup list conformance: ${highlighted.length} items are highlighted.`);
      }
      return highlighted.length ? ITEMS.indexOf(highlighted[0].textContent ?? '') : -1;
    }

    function getHighlightedText() {
      return screen
        .queryAllByRole('menuitem')
        .find((item) => item.hasAttribute('data-highlighted'))?.textContent;
    }

    function getFocusOwner() {
      const active = document.activeElement;
      if (active === getTrigger()) {
        return 'trigger';
      }
      if (screen.queryAllByRole('menuitem').some((item) => item.contains(active))) {
        return 'item';
      }
      if (screen.queryByTestId('popup')?.contains(active)) {
        return 'popup';
      }
      return 'outside';
    }

    async function settle() {
      await act(async () => {
        await waitSingleFrame();
        await waitSingleFrame();
      });
    }

    async function waitForOpen() {
      await waitFor(() => {
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
      });
      await waitFor(() => {
        expect(screen.getAllByRole('menuitem')[0]).toBeVisible();
      });
      // Let opening focus and scroll work scheduled in animation frames settle.
      await settle();
    }

    async function waitForClosed() {
      await waitFor(() => {
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
      });
    }

    async function focusTrigger() {
      await act(async () => {
        getTrigger().focus();
      });
    }

    async function openWithMouse(user: User) {
      await user.click(getTrigger());
      await waitForOpen();
    }

    async function openWithKeyboard(user: User) {
      await focusTrigger();
      await user.keyboard('{ArrowDown}');
      await waitForOpen();
      await waitFor(() => {
        expect(getHighlightedIndex()).not.toBe(-1);
      });
      return getHighlightedIndex();
    }

    async function expectFocusOnItem(index: number) {
      await waitFor(() => {
        expect(getItem(index)).toHaveFocus();
      });
    }

    async function expectNoHighlight() {
      await waitFor(() => {
        expect(getHighlightedIndex()).toBe(-1);
      });
    }

    async function navigateTo(user: User, from: number, to: number) {
      const key = to > from ? '{ArrowDown}' : '{ArrowUp}';
      for (let i = 0; i < Math.abs(to - from); i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await user.keyboard(key);
      }
      await waitFor(() => {
        expect(getHighlightedIndex()).toBe(to);
      });
    }

    function createSpies() {
      const activated: string[] = [];
      return {
        activated,
        options: {
          onItemClick: (event: MouseEvent & { currentTarget: HTMLElement }) => {
            activated.push(event.currentTarget.textContent ?? '');
          },
        } satisfies RenderListOptions,
        expectNothingCommitted() {
          expect(activated).toEqual([]);
        },
      };
    }

    describe('pointer', () => {
      it('highlights and focuses the hovered item', async () => {
        const { user } = renderList();
        await openWithMouse(user);

        await user.hover(getItem(2));

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(2);
        });
        await expectFocusOnItem(2);
      });

      it('clears the highlight when the pointer leaves the list without leaving focus on an item', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        await openWithMouse(user);

        await user.hover(getItem(1));
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(1);
        });

        await user.hover(screen.getByTestId('after'));

        await expectNoHighlight();
        // A focused item that no longer looks highlighted would still respond to Enter.
        await waitFor(() => {
          expect(getFocusOwner()).toBe('popup');
        });
        await user.keyboard('{Enter}');
        await settle();
        spies.expectNothingCommitted();
      });

      it('continues keyboard navigation from the hovered item', async () => {
        const { user } = renderList();
        await openWithMouse(user);
        await user.hover(getItem(4));
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(4);
        });

        await user.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(5);
        });
        await expectFocusOnItem(5);
      });

      it('activates the hovered item with Enter', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        await openWithMouse(user);
        await user.hover(getItem(6));
        await expectFocusOnItem(6);

        await user.keyboard('{Enter}');

        await waitForClosed();
        expect(spies.activated).toEqual([ITEMS[6]]);
      });

      it('lets the pointer take the highlight back after keyboard navigation', async () => {
        const { user } = renderList();
        const start = await openWithKeyboard(user);
        await navigateTo(user, start, 3);

        await user.hover(getItem(1));

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(1);
        });
        await expectFocusOnItem(1);
      });

      it('keeps the highlight when a touch scroll starts on the highlighted item', async () => {
        const { user } = renderList();
        await openWithMouse(user);
        await user.hover(getItem(2));
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(2);
        });

        // The browser takes the touch over for scrolling, cancels the pointer and it leaves.
        const touched = getItem(2);
        fireEvent.pointerDown(touched, { pointerType: 'touch' });
        fireEvent.pointerCancel(touched, { pointerType: 'touch' });
        fireEvent.pointerLeave(touched, {
          pointerType: 'touch',
          relatedTarget: screen.getByTestId('after'),
        });
        await settle();

        expect(getHighlightedIndex()).toBe(2);
      });

      it('keeps the highlight when the pointer moves straight onto content inside another item', async () => {
        const { user } = renderList();
        await openWithMouse(user);
        await user.hover(getItem(1));
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(1);
        });

        const nextItemContent = getItem(2).firstElementChild;
        expect(nextItemContent).toBeInstanceOf(HTMLElement);
        fireEvent.pointerLeave(getItem(1), {
          pointerType: 'mouse',
          relatedTarget: nextItemContent,
        });
        await settle();

        expect(getHighlightedIndex()).toBe(1);
      });

      it('clears the highlight when the pointer leaves an item to outside the document', async () => {
        const { user } = renderList();
        await openWithMouse(user);
        await user.hover(getItem(1));
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(1);
        });

        fireEvent.pointerLeave(getItem(1), { pointerType: 'mouse', relatedTarget: null });
        await settle();

        expect(getHighlightedIndex()).toBe(-1);
      });

      it('does not activate a disabled item', async () => {
        const onItemClick = vi.fn();
        const { user } = renderList({ disabledItems: [ITEMS[1]], onItemClick });
        await openWithMouse(user);
        expect(getItem(1)).toHaveAttribute('aria-disabled', 'true');

        await user.hover(getItem(1));
        await user.keyboard('{Enter}');
        await settle();

        expect(onItemClick).not.toHaveBeenCalled();

        await user.click(getItem(1));
        await settle();

        expect(onItemClick).not.toHaveBeenCalled();
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
        expect(getItem(1)).not.toHaveAttribute('data-selected');

        // An enabled item must reach the same callbacks, so disconnected handlers cannot pass.
        await user.click(getItem(2));
        expect(onItemClick).toHaveBeenCalledTimes(1);
      });

      it('ignores right clicks on the trigger and on items', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);

        await user.pointer({ keys: '[MouseRight]', target: getTrigger() });
        await settle();
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');

        await openWithMouse(user);
        await user.pointer({ keys: '[MouseRight]', target: getItem(2) });
        await settle();

        expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
        spies.expectNothingCommitted();
      });

      // Browser-only upstream: real pointer input and scroll geometry.
      it.skip('keeps the keyboard highlight while the list scrolls under a resting pointer', () => {});
      it.skip('does not scroll the list when hovering a partially visible item at either edge', () => {});
    });

    describe('opening', () => {
      it('starts without a highlight after a pointer opening', async () => {
        const { user } = renderList();
        await openWithMouse(user);

        await expectNoHighlight();
        expect(getFocusOwner()).toBe('popup');

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });
        await expectFocusOnItem(0);
      });

      it('opens on the first item with ArrowDown', async () => {
        const { user } = renderList();
        await focusTrigger();

        await user.keyboard('{ArrowDown}');
        await waitForOpen();

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });
        await expectFocusOnItem(0);
      });

      it('opens on the last item with ArrowUp', async () => {
        const { user } = renderList();
        await focusTrigger();

        await user.keyboard('{ArrowUp}');
        await waitForOpen();

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
        });
        await expectFocusOnItem(ITEMS.length - 1);
      });

      // Requires real layout (scroll geometry).
      it.skip('scrolls the last item into view when opening with ArrowUp', () => {});

      it('opens past a disabled first item', async () => {
        const { user } = renderList({ disabledItems: [ITEMS[0]] });

        const start = await openWithKeyboard(user);

        expect(start).toBe(1);
      });

      it.each(['{Enter}', ' '])('opens with %s without activating an item', async (key) => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        await focusTrigger();

        await user.keyboard(key);
        await waitForOpen();
        await settle();

        expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
        spies.expectNothingCommitted();
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });
        await expectFocusOnItem(0);
      });

      it('starts fresh when reopened after Escape', async () => {
        const { user } = renderList();
        const start = await openWithKeyboard(user);
        await navigateTo(user, start, 7);
        await user.keyboard('{Escape}');
        await waitForClosed();

        await openWithMouse(user);

        await expectNoHighlight();
      });
    });

    describe('keyboard', () => {
      it('moves the highlight one item at a time with the arrow keys', async () => {
        const { user } = renderList();
        const start = await openWithKeyboard(user);

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(start + 1);
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(start);
        });
      });

      it('moves focus along with the highlight', async () => {
        const { user } = renderList();
        const start = await openWithKeyboard(user);
        await expectFocusOnItem(start);

        await user.keyboard('{ArrowDown}');
        await expectFocusOnItem(start + 1);

        await user.keyboard('{ArrowUp}');
        await expectFocusOnItem(start);
      });

      it.each(['{Enter}', ' '])('activates the highlighted item once with %s', async (key) => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        const start = await openWithKeyboard(user);
        await user.keyboard('{ArrowDown}');
        await expectFocusOnItem(start + 1);

        await user.keyboard(key);

        await waitForClosed();
        expect(spies.activated).toEqual([ITEMS[start + 1]]);
        await waitFor(() => {
          expect(getTrigger()).toHaveFocus();
        });
      });

      it('does not submit a surrounding form', async () => {
        const onSubmit = vi.fn();
        const { user } = renderList({
          wrap: (node) => (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              {node()}
              {/* Without a submit button, a form with more than one field never submits implicitly. */}
              <button type="submit">Submit</button>
            </form>
          ),
        });

        await openWithMouse(user);
        await user.keyboard('{Escape}');
        await waitForClosed();
        await focusTrigger();
        await user.keyboard('{Enter}');
        await waitForOpen();
        await user.keyboard('{Escape}');
        await waitForClosed();
        const start = await openWithKeyboard(user);
        await navigateTo(user, start, start + 1);
        await user.keyboard('{Enter}');
        await waitForClosed();

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('stops on a disabled item while navigating', async () => {
        const { user } = renderList({ disabledItems: [ITEMS[2]] });
        const start = await openWithKeyboard(user);
        expect(start).toBe(0);

        await navigateTo(user, 0, 1);
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(2);
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(1);
        });
      });

      it('moves the highlight to the last and first items with End and Home', async () => {
        const { user } = renderList();
        await openWithKeyboard(user);

        await user.keyboard('{End}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
        });

        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });
      });

      // Requires real layout (scroll geometry).
      it.skip('scrolls the last and first items into view with End and Home', () => {});

      it('moves to disabled ends with End and Home', async () => {
        const { user } = renderList({
          disabledItems: [ITEMS[0], ITEMS[ITEMS.length - 1]],
        });
        await openWithKeyboard(user);

        await user.keyboard('{End}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
        });

        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });
      });

      // Requires real layout (scroll geometry).
      it.skip('scrolls the highlighted item into view in both directions, only as far as needed', () => {});
      it.skip('reveals an item reached by typing its label', () => {});

      it('starts a new typeahead search after a pause', async () => {
        const items = ['Alpha', 'Bravo', 'Charlie'];
        const { user } = renderList({ items });
        await focusTrigger();
        await user.keyboard('{ArrowDown}');
        await waitForOpen();

        await user.keyboard('b');
        await waitFor(() => {
          expect(getHighlightedText()).toBe('Bravo');
        });

        // Longer than the typeahead reset delay, so `c` is a new search and not `bc`.
        await act(async () => {
          await wait(1000);
        });
        await user.keyboard('c');

        await waitFor(() => {
          expect(getHighlightedText()).toBe('Charlie');
        });
      });

      it('prevents the default scrolling of navigation keys', async () => {
        const { user } = renderList();
        await expectFocusOnItem(await openWithKeyboard(user));

        for (const key of ['ArrowDown', 'ArrowUp', 'End', 'Home']) {
          const target = document.activeElement ?? document.body;
          // `fireEvent` returns `false` when a handler prevented the default action.
          expect(fireEvent.keyDown(target, { key })).toBe(false);
        }
      });
    });

    describe('list boundaries', () => {
      it('wraps past the first item', async () => {
        const { user } = renderList();
        const start = await openWithKeyboard(user);
        expect(start).toBe(0);

        await user.keyboard('{ArrowUp}');

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
        });
      });

      it('wraps past the last item', async () => {
        const { user } = renderList();
        await focusTrigger();
        await user.keyboard('{ArrowUp}');
        await waitForOpen();
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
        });

        await user.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });
      });

      // Requires real layout (scroll geometry).
      it.skip('scrolls the first item into view when wrapping past the last item', () => {});

      it('keeps a single item reachable', async () => {
        const spies = createSpies();
        const { user } = renderList({ ...spies.options, items: [ITEMS[0]] });
        await openWithKeyboard(user);

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(0);
        });

        await user.keyboard('{Enter}');
        await waitForClosed();
        expect(spies.activated).toEqual([ITEMS[0]]);
      });

      it('opens and handles keys without losing focus when the list is empty', async () => {
        const { user } = renderList({ items: [] });
        await focusTrigger();

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
        });
        await waitFor(() => {
          expect(getFocusOwner()).toBe('popup');
        });

        await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
        await settle();

        expect(getFocusOwner()).toBe('popup');
      });

      it('does not activate anything when every item is disabled', async () => {
        const spies = createSpies();
        const { user } = renderList({ ...spies.options, disabledItems: ITEMS });
        await focusTrigger();

        await user.keyboard('{ArrowDown}');
        await waitForOpen();
        await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
        await settle();

        spies.expectNothingCommitted();
        expect(['trigger', 'item', 'popup']).toContain(getFocusOwner());
      });
    });

    describe('dismissal', () => {
      it('closes on Escape without committing, and keeps focus on the trigger', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        const start = await openWithKeyboard(user);
        await navigateTo(user, start, start + 1);

        await user.keyboard('{Escape}');

        await waitForClosed();
        await waitFor(() => {
          expect(getTrigger()).toHaveFocus();
        });
        expect(getTrigger()).not.toHaveAttribute('aria-activedescendant');
        spies.expectNothingCommitted();
      });

      it('closes on Tab without committing, and moves focus past the trigger', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        const start = await openWithKeyboard(user);
        await navigateTo(user, start, start + 1);

        await user.keyboard('{Tab}');

        await waitForClosed();
        await waitFor(() => {
          expect(screen.getByTestId('after')).toHaveFocus();
        });
        spies.expectNothingCommitted();
      });

      it('closes on Shift+Tab without committing, and moves focus to the element before the popup', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        const start = await openWithKeyboard(user);
        await navigateTo(user, start, start + 1);

        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitForClosed();
        // The popup follows the trigger in focus order.
        await waitFor(() => {
          expect(getTrigger()).toHaveFocus();
        });
        spies.expectNothingCommitted();
      });

      it('closes on an outside press without committing', async () => {
        const spies = createSpies();
        const { user } = renderList(spies.options);
        await openWithMouse(user);
        await user.hover(getItem(1));
        await waitFor(() => {
          expect(getHighlightedIndex()).toBe(1);
        });

        await user.click(document.body);

        await waitForClosed();
        spies.expectNothingCommitted();
      });

      // Browser-only upstream: real pointer input through the modal backdrop.
      it.skip('closes on a real outside click that the page underneath does not receive', () => {});

      it('closes when the trigger is clicked again', async () => {
        const { user } = renderList();
        await openWithMouse(user);

        await user.click(getTrigger());

        await waitForClosed();
        await settle();
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
      });

      it('closes only itself on Escape inside a dialog', async () => {
        const { user } = renderList({
          wrap: (node) => (
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup data-testid="dialog">{node()}</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          ),
        });
        await openWithKeyboard(user);

        await user.keyboard('{Escape}');

        await waitForClosed();
        expect(screen.getByTestId('dialog')).toBeVisible();

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByTestId('dialog')).toBe(null);
        });
      });
    });
  });

  function NestedMenuWithModalProp() {
    const SubmenuRootWithModal = Menu.SubmenuRoot as (
      props: Menu.SubmenuRoot.Props & { modal: boolean },
    ) => JSX.Element;

    return (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <SubmenuRootWithModal defaultOpen modal={false}>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup />
                  </Menu.Positioner>
                </Menu.Portal>
              </SubmenuRootWithModal>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  }

  it('warns that nested menus ignore the modal prop', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      renderWithUser(() => <NestedMenuWithModalProp />);
      await flushMicrotasks();

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `modal` prop is not supported on nested menus. It will be ignored.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  // `isDev` is resolved at build time here; `process.env.NODE_ENV` can't be toggled at runtime.
  it.skip('does not emit the nested modal warning in production', () => {});

  // All these tests run for contained and detached triggers.
  // The rendered menu has the same structure in most cases.
  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenu },
    { name: 'detached triggers', Component: DetachedTriggerMenu },
  ])('when using $name', ({ Component: TestMenu }) => {
    it('sets aria-orientation on a horizontal popup', async () => {
      renderWithUser(() => (
        <TestMenu rootProps={{ defaultOpen: true, orientation: 'horizontal' }} />
      ));

      expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('does not render aria-orientation on a vertical popup', async () => {
      renderWithUser(() => <TestMenu rootProps={{ defaultOpen: true }} />);

      // `menu` is implicitly vertical.
      expect(screen.getByRole('menu')).not.toHaveAttribute('aria-orientation');
    });

    describe('keyboard navigation', () => {
      it('changes the highlighted item using the arrow keys', async () => {
        renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      it('navigates across grouped items with arrow keys and text', async () => {
        const { user } = renderWithUser(() => (
          <TestMenu
            popupProps={{
              get children() {
                return [
                  <Menu.Group>
                    <Menu.Item>Apple</Menu.Item>
                    <Menu.Item>Banana</Menu.Item>
                  </Menu.Group>,
                  <Menu.Group>
                    <Menu.Item>Cherry</Menu.Item>
                  </Menu.Group>,
                ];
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });
        await user.keyboard('[Enter]');

        const apple = await screen.findByRole('menuitem', { name: 'Apple' });
        const banana = screen.getByRole('menuitem', { name: 'Banana' });
        const cherry = screen.getByRole('menuitem', { name: 'Cherry' });

        await waitFor(() => {
          expect(apple).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(banana).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(cherry).toHaveFocus();
        });

        await act(async () => {
          apple.focus();
        });
        await user.keyboard('c');
        await waitFor(() => {
          expect(cherry).toHaveFocus();
        });
      });

      it('closes with a `detail === 0` click event on keyboard item activation', async () => {
        const openChangeSpy = vi.fn();

        renderWithUser(() => <TestMenu rootProps={{ onOpenChange: openChangeSpy }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('[Enter]');

        await waitFor(() => {
          expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        });

        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        // Keyboard activation clicks carry `detail === 0`, which MenuRoot classifies
        // as a keyboard (instant) activation.
        expect((openChangeSpy.mock.lastCall?.[1].event as MouseEvent).detail).toBe(0);
      });

      it('changes the highlighted item using the Home and End keys', async () => {
        renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');
        const item1 = screen.getByTestId('item-1');
        const item5 = screen.getByTestId('item-5');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{End}');
        await waitFor(() => {
          expect(item5).toHaveFocus();
        });

        await userEvent.keyboard('{Home}');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });
      });

      it('includes disabled items during keyboard navigation', async () => {
        renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const disabledItem3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(disabledItem3).toHaveFocus();
        });

        expect(disabledItem3).toHaveAttribute('aria-disabled', 'true');
      });

      it('skips items hidden with CSS during keyboard navigation', async () => {
        renderWithUser(() => (
          <TestMenu
            popupProps={{
              get children() {
                return [
                  <Menu.Item data-testid="item-1" style={{ display: 'none' }}>
                    Item 1
                  </Menu.Item>,
                  <Menu.Item data-testid="item-2">Item 2</Menu.Item>,
                  <Menu.Item data-testid="item-3">Item 3</Menu.Item>,
                ];
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const hiddenItem = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
        expect(hiddenItem).toHaveAttribute('tabindex', '-1');

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      describe('text navigation', () => {
        it('changes the highlighted item', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>Ba</Menu.Item>,
                    <Menu.Item>Bb</Menu.Item>,
                    <Menu.Item>Ca</Menu.Item>,
                    <Menu.Item>Cb</Menu.Item>,
                    <Menu.Item>Cd</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Ca')).toHaveFocus();
          });

          expect(screen.getByText('Ca')).toHaveAttribute('tabindex', '0');

          await user.keyboard('d');
          await waitFor(() => {
            expect(screen.getByText('Cd')).toHaveFocus();
          });

          expect(screen.getByText('Cd')).toHaveAttribute('tabindex', '0');
        });

        it('skips items hidden with CSS in text navigation', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item data-testid="item-hidden" style={{ display: 'none' }}>
                      Apple
                    </Menu.Item>,
                    <Menu.Item data-testid="item-apricot">Apricot</Menu.Item>,
                    <Menu.Item data-testid="item-banana">Banana</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const hiddenItem = screen.getByTestId('item-hidden');
          const apricotItem = screen.getByTestId('item-apricot');
          const bananaItem = screen.getByTestId('item-banana');

          await act(async () => {
            bananaItem.focus();
          });

          await user.keyboard('a');
          await waitFor(() => {
            expect(apricotItem).toHaveFocus();
          });

          expect(hiddenItem).toHaveAttribute('tabindex', '-1');
        });

        it('skips natively disabled items in text navigation', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Apple</Menu.Item>,
                    <Menu.Item
                      data-testid="item-banana"
                      nativeButton
                      render={(props) => <button {...props} type="button" disabled />}
                    >
                      Banana
                    </Menu.Item>,
                    <Menu.Item data-testid="item-blueberry">Blueberry</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const appleItem = screen.getByText('Apple');
          const bananaItem = screen.getByTestId('item-banana');
          const blueberryItem = screen.getByTestId('item-blueberry');

          await act(async () => {
            appleItem.focus();
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(blueberryItem).toHaveFocus();
          });

          expect(bananaItem).toHaveAttribute('tabindex', '-1');
          expect(bananaItem).not.toHaveAttribute('data-highlighted');
        });

        it('changes the highlighted item using text navigation on label prop', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              popupProps={{
                get children() {
                  return [
                    <Menu.Item label="Aa">1</Menu.Item>,
                    <Menu.Item label="Ba">2</Menu.Item>,
                    <Menu.Item label="Bb">3</Menu.Item>,
                    <Menu.Item label="Ca">4</Menu.Item>,
                  ];
                },
              }}
            />
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          await user.click(trigger);
          const items = await screen.findAllByRole('menuitem');
          await flushMicrotasks();
          // The menu focuses itself a frame after a pointer opening; keys sent earlier go to the
          // trigger and the late initial focus would then override the typeahead match.
          await waitForInitialFocus();

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[1]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[1]).toHaveAttribute('tabindex', '0');
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[2]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[2]).toHaveAttribute('tabindex', '0');
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[2]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[2]).toHaveAttribute('tabindex', '0');
          });
        });

        it('skips the non-stringifiable items', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>Ba</Menu.Item>,
                    <Menu.Item />,
                    <Menu.Item>
                      <div>Nested Content</div>
                    </Menu.Item>,
                    <Menu.Item>{undefined}</Menu.Item>,
                    <Menu.Item>{null}</Menu.Item>,
                    <Menu.Item>Bc</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).toHaveAttribute('tabindex', '0');

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Bc')).toHaveFocus();
          });
          expect(screen.getByText('Bc')).toHaveAttribute('tabindex', '0');
        });

        it('navigate to options with diacritic characters', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>Ba</Menu.Item>,
                    <Menu.Item>Bb</Menu.Item>,
                    <Menu.Item>Bą</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).toHaveAttribute('tabindex', '0');

          await user.keyboard('ą');
          await waitFor(() => {
            expect(screen.getByText('Bą')).toHaveFocus();
          });
          expect(screen.getByText('Bą')).toHaveAttribute('tabindex', '0');
        });

        it('navigate to next options that begin with diacritic characters', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Aa</Menu.Item>,
                    <Menu.Item>ąa</Menu.Item>,
                    <Menu.Item>ąb</Menu.Item>,
                    <Menu.Item>ąc</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('ą');
          await waitFor(() => {
            expect(screen.getByText('ąa')).toHaveFocus();
          });
          expect(screen.getByText('ąa')).toHaveAttribute('tabindex', '0');
        });

        it('does not trigger the onClick event when Space is pressed during text navigation', async () => {
          const handleClick = vi.fn();

          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item onClick={() => handleClick()}>Item One</Menu.Item>,
                    <Menu.Item onClick={() => handleClick()}>Item Two</Menu.Item>,
                    <Menu.Item onClick={() => handleClick()}>Item Three</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('Item T');

          expect(handleClick.mock.calls.length > 0).toBe(false);

          await waitFor(() => {
            expect(items[1]).toHaveFocus();
          });
        });

        it('does not open a submenu when pressing Space during a typeahead session', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return (
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">
                        Add to Playlist
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Item>Add now</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  );
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            submenuTrigger.focus();
          });

          await user.keyboard('Add to p');

          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('[Space]');
          expect(screen.queryByTestId('submenu')).toBe(null);

          await user.keyboard('[Space]');
          expect(screen.queryByTestId('submenu')).toBe(null);
        });

        it('opens a focused submenu trigger with Space when not typing', async () => {
          const { user } = renderWithUser(() => <TestMenu rootProps={{ open: true }} />);
          await waitForInitialFocus();

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            submenuTrigger.focus();
          });

          await user.keyboard('[Space]');
          await flushMicrotasks();
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        it('matches "Item 2" after "Item " currently matches "Item 1"', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Item 1</Menu.Item>,
                    <Menu.Item data-testid="item-2">Item 2</Menu.Item>,
                    <Menu.Item>Item 3</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
          const item2 = screen.getByTestId('item-2');

          await act(async () => {
            item1.focus();
          });

          await user.keyboard('Item 2');
          expect(item2).toHaveFocus();
        });

        it('matches a submenu trigger label after a space + numeric suffix', async () => {
          const { user } = renderWithUser(() => (
            <TestMenu
              rootProps={{ open: true }}
              popupProps={{
                get children() {
                  return [
                    <Menu.Item>Item 1</Menu.Item>,
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">Item 2</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Item>Nested 2.1</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>,
                    <Menu.Item>Item 3</Menu.Item>,
                  ];
                },
              }}
            />
          ));
          await waitForInitialFocus();

          const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            item1.focus();
          });

          await user.keyboard('Item 2');
          expect(submenuTrigger).toHaveFocus();
          expect(screen.queryByTestId('submenu')).toBe(null);
        });
      });
    });

    describe('nested menus', () => {
      it.each([
        { orientation: 'vertical', direction: 'ltr', openKey: 'ArrowRight', closeKey: 'ArrowLeft' },
        { orientation: 'vertical', direction: 'rtl', openKey: 'ArrowLeft', closeKey: 'ArrowRight' },
        { orientation: 'horizontal', direction: 'ltr', openKey: 'ArrowDown', closeKey: 'ArrowUp' },
        { orientation: 'horizontal', direction: 'rtl', openKey: 'ArrowDown', closeKey: 'ArrowUp' },
      ] as const)(
        'opens a nested menu of a $orientation $direction menu with $openKey key and closes it with $closeKey',
        async ({ orientation, direction, openKey, closeKey }) => {
          const { user } = renderWithUser(() => (
            <DirectionProvider direction={direction}>
              <TestMenu rootProps={{ open: true, orientation }} submenuProps={{ orientation }} />
            </DirectionProvider>
          ));
          await waitForInitialFocus();

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            submenuTrigger.focus();
          });

          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard(`[${openKey}]`);

          await screen.findByTestId('submenu');

          const submenuItem1 = screen.getByTestId('item-4_1');
          await waitFor(() => {
            expect(submenuItem1).toHaveFocus();
          });

          await user.keyboard(`[${closeKey}]`);
          await flushMicrotasks();

          expect(screen.queryByTestId('submenu')).toBe(null);
          expect(submenuTrigger).toHaveFocus();
        },
      );

      it('opens submenu on click when openOnHover is false', async () => {
        const { user } = renderWithUser(() => (
          <TestMenu submenuTriggerProps={{ openOnHover: false }} />
        ));

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        expect(menu).not.toBe(null);
        expect(await screen.findByTestId('item-4_1')).toHaveTextContent('Item 4.1');
      });

      it('renders root menu portal ownership without an accessibility role', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        const menuPortal = menu.closest('[data-base-ui-portal]');
        const menuPortalId = menuPortal?.id ?? '';
        const owner = menu.ownerDocument.querySelector('span[aria-owns]');

        expect(menuPortalId).not.toBe('');
        expect(owner).toHaveAttribute('aria-owns', menuPortalId);
        expect(owner).not.toHaveAttribute('role');
      });

      it('renders submenu portal ownership as an allowed menu child', async () => {
        const { user } = renderWithUser(() => (
          <TestMenu submenuTriggerProps={{ openOnHover: false }} />
        ));

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        const submenu = await screen.findByTestId('submenu');
        const submenuPortal = submenu.closest('[data-base-ui-portal]');
        const submenuPortalId = submenuPortal?.id ?? '';
        const owner = menu.querySelector('span[aria-owns]');

        expect(submenuPortalId).not.toBe('');
        expect(owner).toHaveAttribute('role', 'group');
        expect(owner).toHaveAttribute('aria-owns', submenuPortalId);
        expect(submenuTrigger).not.toHaveAttribute('aria-owns');
      });

      it('keeps the root menu open when a submenu opens and the trigger `render` element has a custom id', async () => {
        const onOpenChange = vi.fn();
        const { user } = renderWithUser(() => (
          <TestMenu
            rootProps={{ onOpenChange }}
            triggerProps={{ render: (props) => <button {...props} id="custom-trigger" /> }}
            submenuTriggerProps={{ openOnHover: false }}
          />
        ));

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        await screen.findByTestId('menu');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        await screen.findByTestId('submenu');

        expect(screen.getByTestId('menu')).not.toBe(null);
        expect(onOpenChange).not.toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.siblingOpen }),
        );
      });

      it('closes submenus when focus is lost by shift-tabbing from a nested menu', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        const submenuItem = await screen.findByTestId('item-4_1');
        await act(async () => {
          submenuItem.focus();
        });

        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });

        // Shift+Tab should close the submenu and focus should return to the submenu trigger
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).toBe(null);
        });

        expect(submenuTrigger).toHaveFocus();
        expect(screen.getByTestId('menu')).not.toBe(null);
      });

      it('closes the entire tree when clicking outside the deepest submenu', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestMenu />
            <button data-testid="outside">Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        const menu = await screen.findByTestId('menu');
        // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
        await waitFor(() => {
          expect(menu).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger1 = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger1).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('submenu');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger2 = await screen.findByTestId('nested-submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger2).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('nested-submenu');

        const outside = screen.getByTestId('outside');
        await user.click(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
        expect(screen.queryByTestId('submenu')).toBe(null);
        expect(screen.queryByTestId('nested-submenu')).toBe(null);
      });

      it('calls onOpenChange with false exactly once per menu when a submenu item is clicked', async () => {
        const rootOnOpenChange = vi.fn();
        const submenuOnOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <TestMenu
            rootProps={{ onOpenChange: rootOnOpenChange }}
            submenuProps={{ onOpenChange: submenuOnOpenChange }}
            submenuTriggerProps={{ delay: 0, closeDelay: 50 }}
          />
        ));

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        await screen.findByTestId('menu');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        // Schedule a delayed hover close, then click the item before it fires.
        fireEvent.mouseLeave(submenuTrigger);
        fireEvent.click(screen.getByTestId('item-4_1'));

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        // Wait out pending hover close timers; they must not refire a close.
        await wait(100);

        const rootCloseCalls = rootOnOpenChange.mock.calls.filter((args) => args[0] === false);
        const submenuCloseCalls = submenuOnOpenChange.mock.calls.filter(
          (args) => args[0] === false,
        );
        const staleHoverCloseCalls = submenuCloseCalls.filter(
          (args) => args[1].reason === REASONS.triggerHover,
        );
        expect(rootCloseCalls.length).toBe(1);
        expect(submenuCloseCalls.length).toBe(1);
        expect(staleHoverCloseCalls.length).toBe(0);
      });

      it('returns focus to submenu triggers when closing nested menus', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        const menu = await screen.findByTestId('menu');
        // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
        await waitFor(() => {
          expect(menu).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');

        const nestedSubmenuTrigger = await screen.findByTestId('nested-submenu-trigger');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        await waitFor(() => {
          expect(nestedSubmenuTrigger).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('nested-submenu');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_3_1')).toHaveFocus();
        });

        await user.keyboard('[ArrowLeft]');

        await waitFor(() => {
          expect(screen.queryByTestId('nested-submenu')).toBe(null);
        });
        expect(nestedSubmenuTrigger).toHaveFocus();

        await user.keyboard('[ArrowLeft]');

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).toBe(null);
        });
        expect(submenuTrigger).toHaveFocus();
      });
    });
  });
});
