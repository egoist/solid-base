import { Show, createEffect, createRoot, createSignal, onSettled } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { REASONS } from '../../internals/reasons';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { MenuStore } from '../store/MenuStore';
import { useMenuRootContext } from './MenuRootContext';
import {
  TestMenuContents,
  act,
  enterWithMouse,
  flushMicrotasks,
  moveMouse,
  renderWithUser,
  wait,
} from '../test-utils';

type OnItemHighlighted = Menu.Root.Props['onItemHighlighted'];

// Port of the second half of upstream `MenuRoot.test.tsx` (from 'when a submenu opens in the same
// update as its root' to the end).
describe('<Menu.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // Both menus stay mounted so they can open in one update. Blurring the focused submenu trigger
  // lets Escape reach the document.
  describe('when a submenu opens in the same update as its root', () => {
    it('requests the submenu dismissal on Escape from the body', async () => {
      const onSubmenuOpenChange = vi.fn();
      const [open, setOpen] = createSignal(false);

      const { user } = renderWithUser(() => (
        <Menu.Root open={open()}>
          <Menu.Trigger>Menu</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot open={open()} onOpenChange={onSubmenuOpenChange}>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                  <Menu.Portal keepMounted>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu" />
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      await act(() => setOpen(true));
      await waitFor(() => {
        expect(screen.getByTestId('submenu')).toHaveAttribute('data-open');
      });
      await waitFor(() => {
        expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
      });
      await act(() => screen.getByTestId('submenu-trigger').blur());
      expect(document.activeElement).toBe(document.body);

      await user.keyboard('[Escape]');

      expect(onSubmenuOpenChange.mock.calls.length).toBe(1);
      expect(onSubmenuOpenChange.mock.calls[0][0]).toBe(false);
      expect(onSubmenuOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    });

    it('closes the submenu on Escape from the body when the root cancels its dismissal', async () => {
      const [open, setOpen] = createSignal(false);

      function Test() {
        const [submenuClosed, setSubmenuClosed] = createSignal(false);

        return (
          <Menu.Root
            open={open()}
            onOpenChange={(nextOpen, eventDetails) => {
              if (eventDetails.reason === REASONS.escapeKey) {
                eventDetails.cancel();
              }
            }}
          >
            <Menu.Trigger>Menu</Menu.Trigger>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup data-testid="menu">
                  <Menu.SubmenuRoot
                    open={open() && !submenuClosed()}
                    onOpenChange={(nextOpen) => setSubmenuClosed(!nextOpen)}
                  >
                    <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                    <Menu.Portal keepMounted>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="submenu" />
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      await act(() => setOpen(true));
      await waitFor(() => {
        expect(screen.getByTestId('submenu')).toHaveAttribute('data-open');
      });
      await waitFor(() => {
        expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
      });
      await act(() => screen.getByTestId('submenu-trigger').blur());
      expect(document.activeElement).toBe(document.body);

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(screen.getByTestId('submenu')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('menu')).toHaveAttribute('data-open');
    });
  });

  describe('opening a dialog from an item', () => {
    // Skipped: drives a real press-drag-release gesture through the Chrome DevTools Protocol, and
    // relies on the browser synthesizing the gesture's click (Chromium only, not jsdom).
    it.skip('keeps the dialog open after a press-drag-release activation', () => {});
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const onItemHighlighted = vi.fn();
      renderWithUser(() => (
        <Menu.Root open onItemHighlighted={onItemHighlighted}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await flushMicrotasks();

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseMove(item2);

      await waitFor(() => {
        expect(item2).toHaveFocus();
      });
      expect(onItemHighlighted).toHaveBeenLastCalledWith(item2, {
        reason: REASONS.pointer,
        label: 'Item 2',
        event: expect.any(Event),
      });
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      renderWithUser(() => (
        <Menu.Root open highlightItemOnHover={false}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await flushMicrotasks();

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseMove(item2);

      await flushMicrotasks();

      expect(item2).not.toHaveFocus();
    });

    it('does not highlight submenu triggers from mouse enter when disabled', async () => {
      renderWithUser(() => (
        <TestMenuContents
          rootProps={{ open: true, highlightItemOnHover: false }}
          popupProps={{
            get children() {
              return (
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">Submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Nested item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              );
            },
          }}
        />
      ));
      await flushMicrotasks();

      const submenuTrigger = screen.getByTestId('submenu-trigger');
      fireEvent.mouseEnter(submenuTrigger);

      await flushMicrotasks();

      expect(submenuTrigger).not.toHaveAttribute('data-highlighted');
      expect(submenuTrigger).not.toHaveFocus();
    });
  });

  describe('prop: onOpenChangeComplete', () => {
    it('completes initial opening once when a later update replaces the container ref', async () => {
      const completed = vi.fn();

      function TestMenu() {
        const [container, setContainer] = createSignal<HTMLDivElement | null>(null);
        const [step, setStep] = createSignal(0);

        // Two follow-up updates after mounting, like upstream's layout effect chain.
        createEffect(step, (value) => {
          if (value < 2) {
            setStep(value + 1);
          }
        });

        return (
          <>
            <Menu.Root defaultOpen onOpenChangeComplete={completed}>
              <Menu.Trigger>Toggle</Menu.Trigger>
              <Menu.Portal container={container()}>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Show when={step() < 2 ? 'first' : 'second'} keyed>
              {(containerId) => <div ref={setContainer} data-testid={containerId} />}
            </Show>
          </>
        );
      }

      renderWithUser(() => <TestMenu />);
      await waitFor(() => {
        expect(screen.getByTestId('second')).toContainElement(screen.getByRole('menu'));
      });
      await flushMicrotasks();

      expect(completed).toHaveBeenCalledExactlyOnceWith(true);
    });
  });

  describe('prop: disabled', () => {
    it('marks items as disabled when controlled open', async () => {
      renderWithUser(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            get children() {
              return (
                <>
                  <Menu.Item data-testid="item">Item</Menu.Item>
                  <Menu.CheckboxItem data-testid="checkbox-item">Checkbox item</Menu.CheckboxItem>
                  <Menu.RadioGroup>
                    <Menu.RadioItem data-testid="radio-item" value="radio">
                      Radio item
                    </Menu.RadioItem>
                  </Menu.RadioGroup>
                </>
              );
            },
          }}
        />
      ));

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('checkbox-item')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('radio-item')).toHaveAttribute('data-disabled');
    });

    it('does not highlight items with text navigation when controlled open', async () => {
      const { user } = renderWithUser(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            get children() {
              return (
                <>
                  <Menu.Item data-testid="alpha">Alpha</Menu.Item>
                  <Menu.Item data-testid="beta">Beta</Menu.Item>
                </>
              );
            },
          }}
        />
      ));
      await flushMicrotasks();

      const alpha = screen.getByTestId('alpha');
      const beta = screen.getByTestId('beta');

      await act(() => alpha.focus());

      await user.keyboard('b');
      await flushMicrotasks();

      expect(beta).not.toHaveAttribute('data-highlighted');
      expect(beta).not.toHaveFocus();
    });

    it('does not close or activate items when controlled open', async () => {
      const handleOpenChange = vi.fn();
      const handleClick = vi.fn();
      const { user } = renderWithUser(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true, onOpenChange: handleOpenChange }}
          popupProps={{
            get children() {
              return (
                <Menu.Item data-testid="item" onClick={handleClick}>
                  Item
                </Menu.Item>
              );
            },
          }}
        />
      ));

      await user.click(screen.getByTestId('item'));

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('disables submenu triggers when controlled open', async () => {
      const { user } = renderWithUser(() => (
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            get children() {
              return (
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                    Submenu
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>Nested item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              );
            },
          }}
        />
      ));

      const submenuTrigger = screen.getByTestId('submenu-trigger');

      expect(submenuTrigger).toHaveAttribute('data-disabled');

      await user.click(submenuTrigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });
  });

  describe('dynamic items', () => {
    // Upstream runs this with fake timers that advance on their own; real timers behave the same.
    it('skips null items when navigating', async () => {
      function DynamicMenu() {
        const [itemsFiltered, setItemsFiltered] = createSignal(false);

        return (
          <Menu.Root
            onOpenChange={(newOpen) => {
              if (newOpen) {
                setTimeout(() => {
                  setItemsFiltered(true);
                }, 0);
              }
            }}
            onOpenChangeComplete={(newOpen) => {
              if (!newOpen) {
                setItemsFiltered(false);
              }
            }}
          >
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Add to Library</Menu.Item>
                  <Show when={!itemsFiltered()}>
                    <Menu.Item>Add to Playlist</Menu.Item>
                    <Menu.Item>Play Next</Menu.Item>
                    <Menu.Item>Play Last</Menu.Item>
                  </Show>
                  <Menu.Item>Favorite</Menu.Item>
                  <Menu.Item>Share</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      const { user } = renderWithUser(() => <DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      await act(() => trigger.focus());

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Play Next' })).toBe(null);
      });
      // The keyboard open highlights the first item once the focus manager runs (next frame).
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Add to Library' })).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      await user.keyboard('{ArrowDown}'); // loops back to Add to Library

      // A wrapping move focuses on the next frame (upstream's fake clock advances it).
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Add to Library' })).toHaveFocus();
      });
    });
  });

  // Omitted: 'trigger render cost' counts React re-renders of the trigger; Solid components
  // never re-render.

  describe('prop: onItemHighlighted', () => {
    function HighlightMenu(props: { onItemHighlighted: OnItemHighlighted }) {
      return (
        <Menu.Root onItemHighlighted={props.onItemHighlighted}>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>One</Menu.Item>
                <Menu.Item>Two</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>Three</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Nested</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    it('passes the keydown event for keyboard highlights', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <HighlightMenu onItemHighlighted={onItemHighlighted} />
      ));

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await act(() => trigger.focus());
      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.keyboard);
      expect(details.event).toBeInstanceOf(KeyboardEvent);
      expect(details.event.key).toBe('ArrowDown');
    });

    it('passes the keydown event for typeahead highlights', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = renderWithUser(() => (
        <HighlightMenu onItemHighlighted={onItemHighlighted} />
      ));

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await act(() => trigger.focus());
      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });

      await user.keyboard('t');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.keyboard);
      expect(details.event).toBeInstanceOf(KeyboardEvent);
      expect(details.event.key).toBe('t');
    });

    it('passes native mouse and pointer events for pointer highlights', async () => {
      const onItemHighlighted = vi.fn();
      renderWithUser(() => <HighlightMenu onItemHighlighted={onItemHighlighted} />);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
      const item = await screen.findByRole('menuitem', { name: 'Two' });
      // A `detail: 0` click opens like a keyboard press, highlighting the first item once the
      // focus manager runs on the next frame (synchronous in upstream's `act`).
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });
      const hoverEvent = new MouseEvent('mousemove', { bubbles: true });
      fireEvent(item, hoverEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(item, expect.anything());
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.pointer);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.event).toBe(hoverEvent);
      expect(details.event).not.toBeInstanceOf(PointerEvent);

      // React derives `onPointerLeave` from the bubbling `pointerout`; Solid listens to the native
      // `pointerleave`, so that's the event dispatched here.
      const leaveEvent = new PointerEvent('pointerleave', {
        pointerType: 'mouse',
      });
      fireEvent(item, leaveEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(
          undefined,
          expect.objectContaining({ reason: 'pointer', event: leaveEvent }),
        );
      });
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
    });

    it('passes the mouse event when a submenu trigger is hovered', async () => {
      const onItemHighlighted = vi.fn();
      renderWithUser(() => <HighlightMenu onItemHighlighted={onItemHighlighted} />);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
      const submenuTrigger = await screen.findByRole('menuitem', { name: 'Three' });
      await flushMicrotasks();
      fireEvent.mouseEnter(submenuTrigger);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(submenuTrigger, expect.anything());
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.pointer);
      expect(details.event).toBeInstanceOf(MouseEvent);
    });

    describe('reporting after the callback or the list changes', () => {
      function ReportingMenu(props: { onItemHighlighted?: OnItemHighlighted; inserted?: boolean }) {
        return (
          <Menu.Root onItemHighlighted={props.onItemHighlighted}>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Show when={props.inserted}>
                    <Menu.Item>Archive</Menu.Item>
                  </Show>
                  <Menu.Item>One</Menu.Item>
                  <Menu.Item>Two</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      /**
       * Renders `ReportingMenu` with props held in signals (upstream's `setProps`). A function
       * signal would be read as a derived signal, so the callback is wrapped.
       */
      function renderReportingMenu(initial: {
        onItemHighlighted?: OnItemHighlighted;
        inserted?: boolean;
      }) {
        const [callback, setCallback] = createSignal<{ fn: OnItemHighlighted }>({
          fn: initial.onItemHighlighted,
        });
        const [inserted, setInserted] = createSignal(initial.inserted ?? false);
        const result = renderWithUser(() => (
          <ReportingMenu onItemHighlighted={callback().fn} inserted={inserted()} />
        ));
        return {
          ...result,
          async setProps(next: { onItemHighlighted?: OnItemHighlighted; inserted?: boolean }) {
            await act(() => {
              if ('onItemHighlighted' in next) {
                setCallback({ fn: next.onItemHighlighted });
              }
              if ('inserted' in next) {
                setInserted(next.inserted ?? false);
              }
            });
          },
        };
      }

      async function openWithKeyboard(user: { keyboard: (text: string) => Promise<void> }) {
        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(() => trigger.focus());
        await user.keyboard('[Enter]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
        });
      }

      it('does not report a stale highlight reason for a later list change', async () => {
        const onItemHighlighted = vi.fn();
        const { setProps, user } = renderReportingMenu({ onItemHighlighted, inserted: false });

        await openWithKeyboard(user);
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
        });
        expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe(REASONS.keyboard);

        onItemHighlighted.mockClear();
        await setProps({ inserted: true });

        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalled();
        });
        expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe(REASONS.none);
      });

      it('reports highlights correctly after onItemHighlighted is removed and added back', async () => {
        const onItemHighlighted = vi.fn();
        const { setProps, user } = renderReportingMenu({ onItemHighlighted });

        await openWithKeyboard(user);
        const one = screen.getByRole('menuitem', { name: 'One' });
        const two = screen.getByRole('menuitem', { name: 'Two' });

        // Moving while unobserved, then back once observed again, reports the keyboard move.
        await setProps({ onItemHighlighted: undefined });
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(two).toHaveFocus();
        });
        await setProps({ onItemHighlighted });
        onItemHighlighted.mockClear();
        await user.keyboard('[ArrowUp]');
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenLastCalledWith(
            one,
            expect.objectContaining({ reason: REASONS.keyboard }),
          );
        });
      });

      it('reports clearing a highlight made before onItemHighlighted was added', async () => {
        const onItemHighlighted = vi.fn();
        const { setProps, user } = renderReportingMenu({});

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        const one = await screen.findByRole('menuitem', { name: 'One' });
        await flushMicrotasks();
        await user.hover(one);
        await waitFor(() => {
          expect(one).toHaveAttribute('data-highlighted');
        });

        await setProps({ onItemHighlighted });
        await user.unhover(one);
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenLastCalledWith(
            undefined,
            expect.objectContaining({ reason: REASONS.pointer }),
          );
        });
      });
    });
  });

  // Upstream's submenu store subscribes to its parent store (`subscribeToParentMenu`) to forward
  // changes of shared tree state, and these tests guard that subscription. Here the submenu's
  // selectors read the parent store reactively, so there is no subscription to leak or forward;
  // the tests check the equivalent guarantees.
  describe('submenu parent store subscription', () => {
    function trackSubscriptions(store: MenuStore<unknown>) {
      const subscribe = store.subscribe.bind(store);
      let active = 0;
      store.subscribe = (listener) => {
        const unsubscribe = subscribe(listener);
        active += 1;
        let subscribed = true;
        return () => {
          if (subscribed) {
            subscribed = false;
            active -= 1;
          }
          unsubscribe();
        };
      };
      return () => active;
    }

    function StoreCapture(props: { onStore: (store: MenuStore<unknown>) => void }) {
      const store = useMenuRootContext().store;
      // eslint-disable-next-line solid/reactivity
      onSettled(() => props.onStore(store));
      return null;
    }

    function TestMenu(props: {
      showSubmenu: boolean;
      onParentStore: (store: MenuStore<unknown>) => void;
      onSubmenuStore?: (store: MenuStore<unknown>) => void;
    }) {
      return (
        <Menu.Root open>
          <StoreCapture onStore={(store) => props.onParentStore(store)} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Show when={props.showSubmenu}>
                  <Menu.SubmenuRoot>
                    <Show when={props.onSubmenuStore}>
                      <StoreCapture onStore={(store) => props.onSubmenuStore?.(store)} />
                    </Show>
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  </Menu.SubmenuRoot>
                </Show>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    it('releases the subscriptions a submenu adds to its parent store when it unmounts', async () => {
      let parentStore: MenuStore<unknown> | undefined;
      const [showSubmenu, setShowSubmenu] = createSignal(false);
      renderWithUser(() => (
        <TestMenu
          showSubmenu={showSubmenu()}
          onParentStore={(store) => {
            parentStore = store;
          }}
        />
      ));
      await flushMicrotasks();
      const activeSubscriptions = trackSubscriptions(parentStore!);
      const baseline = activeSubscriptions();

      await act(() => setShowSubmenu(true));
      expect(screen.getByRole('menuitem', { name: 'More' })).not.toBe(null);
      await act(() => setShowSubmenu(false));

      expect(activeSubscriptions() - baseline).toBe(0);
    });

    // Omitted: 'releases them under StrictMode' (React StrictMode only).

    it('updates submenu readers when shared parent state changes', async () => {
      let parentStore: MenuStore<unknown> | undefined;
      let submenuStore: MenuStore<unknown> | undefined;
      renderWithUser(() => (
        <TestMenu
          showSubmenu
          onParentStore={(store) => {
            parentStore = store;
          }}
          onSubmenuStore={(store) => {
            submenuStore = store;
          }}
        />
      ));
      await flushMicrotasks();

      // Upstream changes `rootId`, which the Solid Root binds (writes to it are ignored), so this
      // uses `keyboardEventRelay`, another parent state a submenu inherits.
      const relay = () => {};
      const submenuListener = vi.fn();
      const dispose = createRoot((disposeRoot) => {
        createEffect(
          () => submenuStore!.select('keyboardEventRelay'),
          (value) => submenuListener(value),
        );
        return disposeRoot;
      });
      await act(() => parentStore!.set('keyboardEventRelay', relay));
      dispose();

      expect(submenuListener).toHaveBeenLastCalledWith(relay);
    });
  });

  describe('sibling submenus', () => {
    it('keeps a pending hover open on a closed, kept-mounted submenu when a sibling opens', async () => {
      const handleSecondOpenChange = vi.fn();
      const [firstOpen, setFirstOpen] = createSignal(false);

      renderWithUser(() => (
        <Menu.Root defaultOpen>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot open={firstOpen()} onOpenChange={(open) => setFirstOpen(open)}>
                  <Menu.SubmenuTrigger>First</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="first-popup">
                        <Menu.Item>First item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.SubmenuRoot onOpenChange={handleSecondOpenChange}>
                  <Menu.SubmenuTrigger delay={100}>Second</Menu.SubmenuTrigger>
                  <Menu.Portal keepMounted>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="second-popup">
                        <Menu.Item>Second item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await flushMicrotasks();
      expect(screen.getByTestId('second-popup')).not.toHaveAttribute('data-open');
      expect(screen.queryByTestId('first-popup')).toBe(null);

      // Fake timers keep the second submenu's open delay from ending before the first one opens.
      vi.useFakeTimers();
      try {
        enterWithMouse(screen.getByRole('menuitem', { name: 'Second' }));
        await act(() => setFirstOpen(true));
        expect(screen.getByTestId('first-popup')).not.toBe(null);
        expect(handleSecondOpenChange).not.toHaveBeenCalled();

        await act(() => vi.advanceTimersByTime(200));
      } finally {
        vi.useRealTimers();
      }

      expect(handleSecondOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(screen.getByTestId('second-popup')).toHaveAttribute('data-open');
    });
  });

  describe('open change requests', () => {
    it('reports a close after the parent declined a hover open without canceling it', async () => {
      const handleOpenChange = vi.fn();
      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Menu.Root
            open={open()}
            onOpenChange={(nextOpen, eventDetails) => {
              handleOpenChange(nextOpen, eventDetails.reason);
              if (eventDetails.reason !== REASONS.triggerHover) {
                setOpen(nextOpen);
              }
            }}
          >
            <Menu.Trigger openOnHover delay={0}>
              Toggle
            </Menu.Trigger>
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
      renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      enterWithMouse(trigger);
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true, REASONS.triggerHover);
      });
      expect(screen.queryByRole('menu')).toBe(null);
      moveMouse(trigger, document.body);

      // The store can't tell a declined open from one the parent applies later, so the close is
      // reported.
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenLastCalledWith(false, REASONS.triggerHover);
      });
    });

    it('does not report a close after the parent canceled a hover open', async () => {
      const handleOpenChange = vi.fn();
      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Menu.Root
            open={open()}
            onOpenChange={(nextOpen, eventDetails) => {
              handleOpenChange(nextOpen, eventDetails.reason);
              if (eventDetails.reason === REASONS.triggerHover) {
                eventDetails.cancel();
              } else {
                setOpen(nextOpen);
              }
            }}
          >
            <Menu.Trigger openOnHover delay={0}>
              Toggle
            </Menu.Trigger>
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
      renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      enterWithMouse(trigger);
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true, REASONS.triggerHover);
      });
      moveMouse(trigger, document.body);
      await act(() => wait(100));

      expect(handleOpenChange.mock.calls).toEqual([[true, REASONS.triggerHover]]);
    });

    // Upstream compares a repeated request against the last committed React render, so two
    // identical requests made before React re-renders are both reported. The Solid store compares
    // against its current state, which the first request has already updated synchronously, so
    // the second one is dropped as a repeat.
    it('reports the first of two identical requests made in one tick', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger-a">
            Trigger A
          </Menu.Trigger>
          <Menu.Trigger handle={handle} id="trigger-b">
            Trigger B
          </Menu.Trigger>
        </>
      ));

      await user.click(screen.getByRole('button', { name: 'Trigger A' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });
      onOpenChange.mockClear();

      await act(() => {
        handle.open('trigger-b');
        handle.open('trigger-b');
      });

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Trigger B' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('ignores a request made before the root has mounted', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();

      // Upstream requests from a child's layout effect, which runs before the Root's. A Solid
      // Root is ready once its body has run, so the request is made before rendering instead.
      handle.open('trigger');

      renderWithUser(() => (
        <>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      ));
      await flushMicrotasks();

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('accepts a request made after the root has mounted in the same commit', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();

      function OpenOnMount() {
        onSettled(() => {
          handle.open('trigger');
        });
        return null;
      }

      renderWithUser(() => (
        <>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <OpenOnMount />
        </>
      ));
      await flushMicrotasks();

      expect(onOpenChange.mock.calls[0][0]).toBe(true);
      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('ignores a request identical to the open state the root committed', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      renderWithUser(() => (
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>
      ));
      await flushMicrotasks();

      await act(() => handle.open('trigger'));
      expect(screen.queryByRole('menu')).not.toBe(null);
      expect(onOpenChange).toHaveBeenCalledTimes(1);

      await act(() => handle.open('trigger'));

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('ignores a close request while the menu is already closed', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      renderWithUser(() => (
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>
      ));
      await flushMicrotasks();
      expect(screen.queryByRole('menu')).toBe(null);

      await act(() => handle.close());

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('drops a request made after the root unmounts', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      const [showRoot, setShowRoot] = createSignal(true);

      renderWithUser(() => (
        <>
          <Show when={showRoot()}>
            <Menu.Root handle={handle} onOpenChange={onOpenChange}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Show>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>
      ));
      await flushMicrotasks();
      const store = handle.store;
      await act(() => setShowRoot(false));

      await act(() => store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction)));

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('reports the committed active trigger for a close that carries no trigger', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger-a">
            Trigger A
          </Menu.Trigger>
          <Menu.Trigger handle={handle} id="trigger-b">
            Trigger B
          </Menu.Trigger>
        </>
      ));

      await user.click(screen.getByRole('button', { name: 'Trigger B' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });
      onOpenChange.mockClear();

      await act(() => handle.close());

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(
        screen.getByRole('button', { name: 'Trigger B' }),
      );
    });

    it('resets allowMouseEnter once the menu unmounts after closing', async () => {
      const handle = Menu.createHandle();
      renderWithUser(() => (
        <>
          <Menu.Root handle={handle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>
      ));
      await flushMicrotasks();

      await act(() => handle.open('trigger'));
      await act(() => (handle.store as MenuStore<unknown>).set('allowMouseEnter', true));
      expect(handle.store.state.allowMouseEnter).toBe(true);

      await act(() => handle.close());
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      expect(handle.store.state.allowMouseEnter).toBe(false);
    });

    it('marks a close without a reason as a dismissal', async () => {
      const handle = Menu.createHandle();
      renderWithUser(() => (
        <>
          <Menu.Root handle={handle}>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>
      ));
      await flushMicrotasks();

      await act(() => handle.open('trigger'));
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');

      await act(() =>
        handle.store.setOpen(
          false,
          createChangeEventDetails(undefined as unknown as typeof REASONS.none),
        ),
      );

      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
    });

    it('commits a hover open after the hover event has been dispatched', async () => {
      const menuPresentDuringEvent: boolean[] = [];
      renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger openOnHover delay={0}>
            Trigger
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await flushMicrotasks();
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      function recordMenu() {
        menuPresentDuringEvent.push(screen.queryByRole('menu') !== null);
      }

      // The trigger opens from a native `mouseenter` listener. One added after it runs once the
      // menu has handled the event.
      trigger.addEventListener('mouseenter', recordMenu);
      try {
        trigger.dispatchEvent(new MouseEvent('mouseenter'));
      } finally {
        trigger.removeEventListener('mouseenter', recordMenu);
      }

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });
      expect(menuPresentDuringEvent).toEqual([false]);
    });

    // Skipped: needs a real CSS exit animation (jsdom runs no animations).
    it.skip('reopens immediately when re-hovering the trigger during its close transition', () => {});

    // Skipped: upstream runs it only in a real browser (`it.skipIf(isJSDOM)`).
    it.skip('leaves focus outside the menu when a keepMounted submenu reopens on hover', () => {});
  });
});

