import { createSignal, flush } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from '..';
import { Dialog } from '../../dialog';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import {
  ContainedTriggerMenu,
  DetachedTriggerMenu,
  act,
  enterWithMouse,
  flushMicrotasks,
  moveMouse,
  renderWithUser,
  wait,
} from '../test-utils';

// Port of upstream `MenuRoot.test.tsx` (the interaction sub-describes of the
// contained/detached triggers block, plus the keepMounted tabbing test that follows it).

function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

function useFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

describe('<Menu.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // All these tests run for contained and detached triggers.
  // The rendered menu has the same structure in most cases.
  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenu },
    { name: 'detached triggers', Component: DetachedTriggerMenu },
  ])('when using $name', ({ Component: TestMenu }) => {
    describe('nested popups', () => {
      it('keeps the menu and dialog open when pressing Shift+Tab inside a nested dialog', async () => {
        function MenuWithNestedDialog() {
          return (
            <Menu.Root>
              <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="menu-popup">
                    <Menu.Item>Item 1</Menu.Item>
                    <Dialog.Root>
                      <Menu.Item
                        render={(props) => <Dialog.Trigger {...props} />}
                        closeOnClick={false}
                        nativeButton
                        data-testid="dialog-trigger"
                      >
                        Open Dialog
                      </Menu.Item>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="dialog-popup">
                          <button type="button" data-testid="dialog-button">
                            Dialog Button
                          </button>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                    <Menu.Item>Item 2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        }

        const { user } = renderWithUser(() => <MenuWithNestedDialog />);

        const menuTrigger = screen.getByTestId('menu-trigger');
        await user.click(menuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('menu-popup')).not.toBe(null);
        });

        const dialogTrigger = screen.getByTestId('dialog-trigger');
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
        });

        const dialogButton = screen.getByTestId('dialog-button');
        await act(async () => {
          dialogButton.focus();
        });

        await waitFor(() => {
          expect(dialogButton).toHaveFocus();
        });

        // Shift+Tab inside the dialog should NOT close the menu or the dialog
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await flushMicrotasks();

        // Both menu and dialog should still be open
        expect(screen.getByTestId('menu-popup')).toBeInTheDocument();
        expect(screen.getByTestId('dialog-popup')).toBeInTheDocument();
      });

      // Skipped: browser-only upstream (relies on real focus/pointer behavior).
      it.skip('keeps focus in a nested alert dialog popup when the pointer leaves the triggering menu item', () => {});

      // Skipped: browser-only upstream (relies on real focus/pointer behavior).
      it.skip('keeps pending focus in a nested dialog when the pointer leaves the triggering menu item', () => {});
    });

    describe('focus management', () => {
      it('focuses the first item after the menu is opened by keyboard', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[Enter]');

        await waitFor(() => {
          expect(screen.getAllByRole('menuitem')[0].tabIndex).toBe(0);
        });
        const [, ...otherItems] = screen.getAllByRole('menuitem');
        otherItems.forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the first item when down arrow key opens the menu', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');

        await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());
        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        expect(firstItem.tabIndex).toBe(0);
        otherItems.forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the last item when up arrow key opens the menu', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowUp]');

        await waitFor(() => {
          expect(screen.getAllByRole('menuitem')[4]).toHaveFocus();
        });

        const items = screen.getAllByRole('menuitem');
        expect(items[4].tabIndex).toBe(0);
        [items[0], items[1], items[2], items[3]].forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the trigger after the menu is closed', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <input type="text" />
            <TestMenu />
            <input type="text" />
          </div>
        ));

        const button = screen.getByRole('button', { name: 'Toggle' });
        await user.click(button);

        const menuItem = await screen.findAllByRole('menuitem');
        await user.click(menuItem[0]);

        expect(button).toHaveFocus();
      });

      // Skipped: browser-only upstream (needs real CSS transitions).
      it.skip('focuses the trigger after Escape when the closing menu receives mouseleave', () => {});

      // Skipped: browser-only upstream.
      it.skip('focuses the trigger after the menu is closed but not unmounted', () => {});
    });

    describe('focus guards', () => {
      it('closes the menu and moves focus to the next element when tabbing forward from the open menu', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <input />
            <TestMenu rootProps={{ modal: false }} />
            <input data-testid="after" />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        const menuItem = screen.getByTestId('item-1');
        await act(async () => {
          menuItem.focus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
      });

      it('closes the menu and moves focus to the trigger when shift-tabbing from the open menu', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <input data-testid="before" />
            <TestMenu />
            <input />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        const menuItem = screen.getByTestId('item-1');
        await act(async () => {
          menuItem.focus();
        });

        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
      });
    });

    describe('prop: closeParentOnEsc', () => {
      it('does not close the parent menu when the Escape key is pressed by default', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await user.keyboard('[Escape]');

        await waitFor(() => {
          expect(screen.queryAllByRole('menu', { hidden: false }).length).toBe(1);
        });

        expect(screen.queryAllByRole('menu', { hidden: false })[0].dataset.testid).toBe('menu');
      });

      it('does not close the parent menu when the Escape key is pressed while focus is outside the menus', async () => {
        const { user } = renderWithUser(() => <TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await act(async () => {
          screen.getByTestId('item-4_1').blur();
        });
        expect(document.activeElement).toBe(document.body);

        await user.keyboard('[Escape]');

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).toBe(null);
        });
        expect(screen.getByTestId('menu')).not.toBe(null);
      });

      it('closes the parent menu when the Escape key is pressed  if `closeParentOnEsc=true`', async () => {
        const { user } = renderWithUser(() => (
          <TestMenu submenuProps={{ closeParentOnEsc: true }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Item 4.1' })).toHaveFocus();
        });

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
      });
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestMenu rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestMenu rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });
    });

    describe('hover close', () => {
      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        renderWithUser(() => <TestMenu rootProps={{ defaultOpen: true }} />);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        flush();

        expect(screen.queryByRole('menu')).not.toBe(null);
      });
    });

    describe('controlled open interactions', () => {
      it('returns focus to the opener when a menu is opened programmatically', async () => {
        function Test() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                Open menu programmatically
              </button>
              <Menu.Root open={open()} triggerId="menu-trigger" onOpenChange={(o) => setOpen(o)}>
                <Menu.Trigger id="menu-trigger">Menu trigger</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Close menu</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </>
          );
        }

        const { user } = renderWithUser(() => <Test />);

        const opener = screen.getByRole('button', { name: 'Open menu programmatically' });
        await user.click(opener);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await user.click(screen.getByRole('menuitem', { name: 'Close menu' }));

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
        expect(opener).toHaveFocus();
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestMenu
                rootProps={{
                  get open() {
                    return open();
                  },
                  onOpenChange: (o) => setOpen(o),
                }}
              />
            </>
          );
        }

        const { user } = renderWithUser(() => <App />);

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        flush();

        expect(screen.queryByRole('menu')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestMenu
              rootProps={{
                get open() {
                  return open();
                },
                onOpenChange: (o) => setOpen(o),
                modal: false,
              }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />
          );
        }

        renderWithUser(() => <App />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);
        flush();

        expect(screen.queryByRole('menu')).not.toBe(null);

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        flush();

        expect(screen.queryByRole('menu')).toBe(null);
      });

      it('keeps the trigger that reopens the menu before its exit animation completes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        let finishExit!: () => void;
        const exitFinished = new Promise<void>((resolve) => {
          finishExit = resolve;
        });
        let setOpenExternal!: (open: boolean) => void;
        // Lets the test hold a controlled reopen back until the exit animation's completion
        // callback has run.
        let deferOpenChange = false;
        let deferredOpen: boolean | null = null;

        function App() {
          const [open, setOpen] = createSignal(false);
          setOpenExternal = (next) => setOpen(next);

          return (
            <Menu.Root
              open={open()}
              onOpenChange={(nextOpen) => {
                if (deferOpenChange) {
                  deferredOpen = nextOpen;
                } else {
                  setOpen(nextOpen);
                }
              }}
            >
              <Menu.Trigger>Trigger 1</Menu.Trigger>
              <Menu.Trigger>Trigger 2</Menu.Trigger>
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
        const popup = screen.getByTestId('popup');

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        Object.defineProperty(popup, 'getAnimations', {
          value: () => [{ finished: exitFinished }],
          configurable: true,
        });

        await act(async () => setOpenExternal(false));
        expect(popup).toHaveAttribute('data-ending-style');

        deferOpenChange = true;
        await user.click(trigger2);
        await waitFor(() => {
          expect(deferredOpen).toBe(true);
        });

        await act(async () => {
          finishExit();
        });
        await act(async () => setOpenExternal(true));

        expect(trigger2).toHaveAttribute('aria-expanded', 'true');
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      it('clears the active trigger when a controlled close completes without a reopen', async () => {
        let setOpenExternal!: (open: boolean) => void;

        function App() {
          const [open, setOpen] = createSignal(false);
          setOpenExternal = (next) => setOpen(next);

          return (
            <Menu.Root open={open()} onOpenChange={(o) => setOpen(o)}>
              <Menu.Trigger>Trigger 1</Menu.Trigger>
              <Menu.Trigger>Trigger 2</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        await act(async () => setOpenExternal(false));
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        await act(async () => setOpenExternal(true));
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });
    });

    // Skipped: upstream runs these in a real browser only (scroll lock measures layout).
    describe.skip('scroll locking', () => {
      it('should not apply scroll lock when opened via touch', () => {});
      it('should apply scroll lock when opened via mouse', () => {});
      it('should apply scroll lock when a touch-opened popup covers the viewport width', () => {});
      it('should not apply scroll lock when a touch-opened popup is narrower than the viewport', () => {});
    });

    describe('prop: actionsRef', () => {
      it('unmounts the menu when the `unmount` method is called', async () => {
        const actionsRef: { current: Menu.Root.Actions | null } = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = renderWithUser(() => (
          <TestMenu
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(() => {
          trigger.focus();
        });

        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await act(async () => {
          await new Promise((resolve) => {
            requestAnimationFrame(resolve);
          });

          actionsRef.current!.unmount();
        });

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });
    });

    describe('prop: openOnHover', () => {
      it('opens when the trigger is hovered and closes when it is no longer hovered', async () => {
        renderWithUser(() => <TestMenu triggerProps={{ openOnHover: true, delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        enterWithMouse(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        moveMouse(trigger, document.body);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });

      it('cancels a pending hover open when the `close` action is called', async () => {
        const handleOpenChange = vi.fn();
        const actionsRef: { current: Menu.Root.Actions | null } = { current: null };
        renderWithUser(() => (
          <TestMenu
            rootProps={{ actionsRef, onOpenChange: handleOpenChange }}
            triggerProps={{ openOnHover: true, delay: 100 }}
          />
        ));

        enterWithMouse(screen.getByRole('button', { name: 'Toggle' }));
        await act(async () => {
          actionsRef.current!.close();
          await wait(200);
        });

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).toBe(null);
      });

      it('opens the submenu on hover with zero delay', async () => {
        renderWithUser(() => (
          <ContainedTriggerMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0 }}
          />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });
      });

      it('does not clear body pointer-events styles when closing a scoped submenu', async () => {
        renderWithUser(() => (
          <TestMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0, closeDelay: 0 }}
          />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        const previousBodyPointerEvents = document.body.style.pointerEvents;
        try {
          document.body.style.pointerEvents = 'none';

          const sibling = screen.getByTestId('item-2');
          // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
          fireEvent.mouseMove(sibling);

          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).toBe(null);
          });

          expect(document.body.style.pointerEvents).toBe('none');
        } finally {
          document.body.style.pointerEvents = previousBodyPointerEvents;
        }
      });

      it('scopes submenu safePolygon pointer events to the parent menu with keepMounted portal', async () => {
        renderWithUser(() => (
          <TestMenu
            rootProps={{ defaultOpen: true }}
            popupProps={{
              get children() {
                return [
                  <Menu.Item data-testid="item-1">Item 1</Menu.Item>,
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger data-testid="submenu-trigger" delay={0}>
                      Item 2
                    </Menu.SubmenuTrigger>
                    <Menu.Portal keepMounted>
                      <Menu.Positioner data-testid="submenu-positioner">
                        <Menu.Popup data-testid="submenu">
                          <Menu.Item>Item 2.1</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>,
                  <Menu.Item data-testid="item-3">Item 3</Menu.Item>,
                ];
              },
            }}
          />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const menu = screen.getByTestId('menu');
        const submenuPositioner = screen.getByTestId('submenu-positioner');

        expect(menu.style.pointerEvents).toBe('none');
        expect(submenuPositioner.style.pointerEvents).toBe('auto');
        expect(screen.getByTestId('item-3').style.pointerEvents).toBe('');
      });

      it('should not close when submenu is hovered after root menu is hovered', async () => {
        renderWithUser(() => (
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });

        const menu = screen.getByTestId('menu');

        await userEvent.hover(menu);

        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const submenu = screen.getByTestId('submenu');

        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        fireEvent.mouseMove(menu);
        fireEvent.mouseLeave(menu);
        await userEvent.hover(submenu);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      it('keeps the parent submenu open after a third-level submenu closes due to sibling hover', async () => {
        renderWithUser(() => (
          <ContainedTriggerMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });

        // Open first-level submenu
        const level1Trigger = screen.getByRole('menuitem', { name: 'Item 4' });
        await userEvent.hover(level1Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        // Open second-level submenu
        const level2Trigger = screen.getByRole('menuitem', { name: 'Item 4.3' });
        await userEvent.hover(level2Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('nested-submenu')).not.toBe(null);
        });

        // Hover a sibling item in the parent submenu to close the second-level submenu
        const parentSibling = screen.getByRole('menuitem', { name: 'Item 4.2' });
        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        fireEvent.mouseMove(parentSibling);

        await waitFor(() => {
          expect(screen.queryByTestId('nested-submenu')).toBe(null);
        });

        // Now unhover the parent submenu container; it should remain open
        const submenu1 = screen.getByTestId('submenu');
        fireEvent.mouseLeave(submenu1);

        // Parent submenu should still be open
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      describe('modal behavior', () => {
        useFakeTimers();

        it('reopens on hover after an impatient click closes via item press', async () => {
          renderWithUser(() => <TestMenu triggerProps={{ openOnHover: true, delay: 100 }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.toBe(null);

          tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();

          fireEvent.click(screen.getByTestId('item-1'));

          await flushMicrotasks();

          expect(screen.queryByRole('menu')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        it('treats hover-opened menus as modal after a click', async () => {
          renderWithUser(() => (
            <Menu.Root>
              <Menu.Trigger openOnHover delay={0}>
                Toggle
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('menu')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).toBe(null);

          tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();
          expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
        });
      });
    });

    describe('prop: closeDelay', () => {
      useFakeTimers();

      it('should close after delay', async () => {
        renderWithUser(() => (
          <TestMenu triggerProps={{ openOnHover: true, delay: 0, closeDelay: 100 }} />
        ));

        const anchor = screen.getByRole('button');

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Item 1')).not.toBe(null);

        fireEvent.mouseLeave(anchor);

        tick(50);

        expect(screen.getByText('Item 1')).not.toBe(null);

        tick(50);

        expect(screen.queryByText('Item 1')).toBe(null);
      });

      it('should close submenu after delay when hovering a sibling item', async () => {
        renderWithUser(() => (
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />
        ));

        const trigger = screen.getByRole('button');

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        fireEvent.mouseMove(siblingItem);

        // Submenu should still be open after partial delay
        tick(50);
        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Submenu should close after the full delay
        tick(50);
        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('should not restart closeDelay on repeated mousemove over sibling items', async () => {
        renderWithUser(() => (
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />
        ));

        const trigger = screen.getByRole('button');

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        fireEvent.mouseMove(siblingItem);

        // Wait 80ms (most of the delay), then move again over the sibling
        tick(80);
        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Move again - this should NOT restart the timer
        fireEvent.mouseMove(siblingItem);

        // After 20 more ms (100ms total from first move), the submenu should close
        tick(20);
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
    });

    describe('submenu hover open', () => {
      useFakeTimers();

      it('opens a submenu after a plain delay without waiting for the pointer to rest', async () => {
        // The menu is opened programmatically, so `allowMouseEnter` starts
        // `false`. Hovering the submenu trigger as the first item must still
        // open it after a plain delay rather than collapsing to a rest-only
        // path that requires the cursor to stop moving.
        renderWithUser(() => (
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });

        // Keep the pointer moving past the open delay so it never comes to rest.
        tick(40);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        tick(40);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        tick(40);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);
      });

      it('cancels a pending submenu hover-open when the pointer leaves via mouseout', async () => {
        // Chrome can drop a submenu trigger's non-bubbling `mouseleave` during a
        // fast pointer sweep across adjacent triggers, but the bubbling
        // `mouseout` still fires. The pending delayed open must be cancelled from
        // that `mouseout`, otherwise a stale submenu opens for a trigger the
        // pointer has already left (stranding the parent at
        // `pointer-events: none`). See #5152.
        renderWithUser(() => (
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        const otherItem = screen.getByTestId('item-1');

        // Arm the submenu's delayed open, then leave the trigger via `mouseout`
        // (with `relatedTarget` outside it) but without delivering `mouseleave`.
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseOut(submenuTrigger, { relatedTarget: otherItem });

        // Let the open delay elapse.
        tick(200);
        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('keeps a pending submenu hover-open when mouseout stays within the trigger', async () => {
        // `mouseout` bubbles and fires as the pointer moves between elements
        // inside the trigger's own subtree. Those crossings (where
        // `relatedTarget` is still inside the trigger) must not cancel the
        // pending open, otherwise a plain hover would never open the submenu.
        // See #5152.
        renderWithUser(() => (
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />
        ));

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        // Arm the submenu's delayed open, then fire a `mouseout` whose
        // `relatedTarget` is still inside the trigger (the trigger itself).
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseOut(submenuTrigger, { relatedTarget: submenuTrigger });

        // Let the open delay elapse.
        tick(200);
        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);
      });
    });

    // Skipped: upstream runs these in a real browser only (real pointer drag sequences).
    describe.skip('mouse interaction', () => {
      it('triggers a menu item and closes the menu on click, drag, release', () => {});
      it('continues arrow navigation from a checkbox item selected by drag release', () => {});
      it('focuses a disabled item on drag release without activating it', () => {});
      it('closes the menu on click, drag outside, release', () => {});
    });

    describe('BaseUIChangeEventDetails', () => {
      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = renderWithUser(() => (
          <TestMenu
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByRole('menu')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });
    });
  });

  it('does not leave a tabbable item after tabbing out of a keepMounted menu before close', async () => {
    const actionsRef: { current: Menu.Root.Actions | null } = {
      current: {
        unmount: vi.fn(),
        close: vi.fn(),
      },
    };

    const { user } = renderWithUser(() => (
      <div>
        <input />
        <DetachedTriggerMenu
          rootProps={{ modal: false, actionsRef }}
          portalProps={{ keepMounted: true }}
        />
        <input data-testid="after" />
      </div>
    ));

    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await act(async () => {
      trigger.focus();
    });
    await user.keyboard('[Enter]');

    const menuItem = await screen.findByTestId('item-1');
    await waitFor(() => {
      expect(menuItem).toHaveFocus();
    });
    expect(menuItem).toHaveAttribute('tabindex', '0');

    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    await act(async () => {
      actionsRef.current!.close();
    });

    await waitFor(() => {
      expect(screen.getByTestId('menu')).not.toHaveAttribute('data-open');
    });
    expect(menuItem).toHaveAttribute('tabindex', '-1');
  });
});
