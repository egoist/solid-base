import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { detachedTriggersConformanceTests } from '../../popover/anchoredPopupTestUtils';
import { renderWithUser, wait } from '../test-utils';

describe('<MenuRoot />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  detachedTriggersConformanceTests({
    createHandle: Menu.createHandle,
    Root: Menu.Root,
    Trigger: Menu.Trigger,
    Portal: Menu.Portal,
    Positioner: Menu.Positioner,
    Popup: Menu.Popup,
    Viewport: Menu.Viewport,
    openInteractions: ['click'],
    ariaExpanded: true,
    throwOnMissingTrigger: true,
  });

  // Skipped: upstream runs these only in a real browser. They drive CSS position and exit
  // transitions (`getAnimations()`) to race the `trigger-change` instant restoration, which jsdom
  // can't animate.
  describe.skip('multiple detached triggers (requires real CSS transitions)', () => {
    it('does not apply the trigger-change instant to a hover close after switching triggers', () => {});
    it('does not restore the trigger-change instant when a controlled close commits late', () => {});
    it('does not restore the trigger-change instant after a hover close has started', () => {});
  });

  // Upstream runs this suite only in real browsers; it uses no layout or animations, so it runs
  // here too.
  describe('nested menus', () => {
    describe.each([{ mode: 'contained' as const }, { mode: 'detached' as const }])(
      'with $mode triggers',
      ({ mode }) => {
        /**
         * Renders two triggers for one menu: as Root children (`contained`) or outside the Root,
         * connected with a handle (`detached`).
         */
        function TwoTriggerMenu(props: { children: JSX.Element }) {
          if (mode === 'contained') {
            return (
              <Menu.Root>
                <Menu.Trigger>Trigger 1</Menu.Trigger>
                <Menu.Trigger>Trigger 2</Menu.Trigger>
                {props.children}
              </Menu.Root>
            );
          }

          const handle = Menu.createHandle();
          return (
            <>
              <Menu.Trigger handle={handle}>Trigger 1</Menu.Trigger>
              <Menu.Trigger handle={handle}>Trigger 2</Menu.Trigger>
              <Menu.Root handle={handle}>{props.children}</Menu.Root>
            </>
          );
        }

        it('supports keyboard navigation regardless of which trigger opened the menu', async () => {
          const { user } = renderWithUser(() => (
            <TwoTriggerMenu>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Standalone</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </TwoTriggerMenu>
          ));

          const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
          const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

          await user.click(trigger1);
          await screen.findByTestId('menu');
          // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
          await waitFor(() => {
            expect(screen.getByRole('menu')).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');

          const submenuItem = await screen.findByTestId('submenu-item');
          await waitFor(() => {
            expect(submenuItem).toHaveFocus();
          });

          await user.keyboard('[ArrowLeft]');
          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).toBe(null);
          });
          expect(submenuTrigger).toHaveFocus();

          await user.keyboard('[Escape]');
          await waitFor(() => {
            expect(screen.queryByTestId('menu')).toBe(null);
          });

          await user.click(trigger2);
          await screen.findByTestId('menu');
        });

        it('opens a submenu on click when hover is disabled', async () => {
          const { user } = renderWithUser(() => (
            <TwoTriggerMenu>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Standalone</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                        More
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </TwoTriggerMenu>
          ));

          const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
          const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

          await user.click(trigger1);
          await screen.findByTestId('menu');
          expect(screen.queryByTestId('submenu')).toBe(null);

          const submenuTrigger = screen.getByTestId('submenu-trigger');
          await user.click(submenuTrigger);

          const submenuItem = await screen.findByTestId('submenu-item');
          expect(submenuItem.textContent).toBe('Nested');

          await user.click(submenuItem);
          await waitFor(() => {
            expect(screen.queryByTestId('menu')).toBe(null);
          });

          await user.click(trigger2);
          await screen.findByTestId('menu');
          expect(screen.queryByTestId('submenu')).toBe(null);
        });

        it('closes every level when clicking outside the deepest submenu', async () => {
          const { user } = renderWithUser(() => (
            <div>
              <TwoTriggerMenu>
                <Menu.Portal>
                  <Menu.Positioner data-testid="level-1">
                    <Menu.Popup>
                      <Menu.Item>Item 1</Menu.Item>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger data-testid="submenu-trigger-1">
                          Level 2
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner data-testid="level-2">
                            <Menu.Popup>
                              <Menu.Item>Item 2</Menu.Item>
                              <Menu.SubmenuRoot>
                                <Menu.SubmenuTrigger data-testid="submenu-trigger-2">
                                  Level 3
                                </Menu.SubmenuTrigger>
                                <Menu.Portal>
                                  <Menu.Positioner data-testid="level-3">
                                    <Menu.Popup>
                                      <Menu.Item>Deep Item</Menu.Item>
                                    </Menu.Popup>
                                  </Menu.Positioner>
                                </Menu.Portal>
                              </Menu.SubmenuRoot>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </TwoTriggerMenu>
              <button data-testid="outside">Outside</button>
            </div>
          ));

          const trigger = screen.getByRole('button', { name: 'Trigger 1' });
          await user.click(trigger);
          await screen.findByTestId('level-1');
          // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
          await waitFor(() => {
            expect(screen.getByRole('menu')).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger1 = await screen.findByTestId('submenu-trigger-1');
          await waitFor(() => {
            expect(submenuTrigger1).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('level-2');
          await waitFor(() => {
            expect(screen.getByRole('menuitem', { name: 'Item 2' })).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          const submenuTrigger2 = await screen.findByTestId('submenu-trigger-2');
          await waitFor(() => {
            expect(submenuTrigger2).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('level-3');

          await user.click(screen.getByTestId('outside'));
          await waitFor(() => {
            expect(screen.queryByTestId('level-1')).toBe(null);
          });
          expect(screen.queryByTestId('level-2')).toBe(null);
          expect(screen.queryByTestId('level-3')).toBe(null);
        });

        it('selects nested items with click, drag, release', async () => {
          const clickSpy = vi.fn();
          const { user } = renderWithUser(() => (
            <TwoTriggerMenu>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item" onClick={clickSpy}>
                              Nested Action
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </TwoTriggerMenu>
          ));

          const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
          fireEvent.mouseDown(trigger1);

          await screen.findByTestId('menu');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await user.hover(submenuTrigger);
          await screen.findByTestId('submenu');

          // Wait 200ms to enable mouseup on menu items
          await wait(200);

          const submenuItem = await screen.findByTestId('submenu-item');
          fireEvent.mouseUp(submenuItem);

          await waitFor(() => {
            expect(screen.queryByTestId('menu')).toBe(null);
          });
          expect(clickSpy.mock.calls.length).toBe(1);

          const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
          await user.click(trigger2);
          await screen.findByTestId('menu');
        });
      },
    );
  });

  // Upstream also renders `StoreInspector` (a React dev tool that serializes the store); there is
  // no Solid equivalent, so this covers the controlled flow alone.
  describe('controlled open and triggerId fed from the change details', () => {
    function App(props: { handle: Menu.Handle<string> }) {
      const [open, setOpen] = createSignal(false);
      const [triggerId, setTriggerId] = createSignal<string | null>(null);

      return (
        <>
          <Menu.Root
            handle={props.handle}
            open={open()}
            triggerId={triggerId()}
            onOpenChange={(nextOpen, eventDetails) => {
              setOpen(nextOpen);
              setTriggerId(eventDetails.trigger?.id ?? null);
            }}
          >
            {(data: { payload: string | undefined }) => (
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Item>{data.payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            )}
          </Menu.Root>
          <Menu.Trigger handle={props.handle} payload="Library">
            Library
          </Menu.Trigger>
          <Menu.Trigger handle={props.handle} payload="Playback" id="second-trigger">
            Playback
          </Menu.Trigger>
          <Menu.Trigger handle={props.handle} payload="Sharing">
            Sharing
          </Menu.Trigger>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTriggerId('second-trigger');
            }}
          >
            Open externally
          </button>
          <button type="button" onClick={() => props.handle.open('second-trigger')}>
            Open via handle
          </button>
        </>
      );
    }

    async function expectOpenWith(item: string) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('menuitem')).toHaveTextContent(item);
      });
    }

    async function expectClosed() {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    }

    it('opens from each trigger, an item, and both external buttons', async () => {
      const handle = Menu.createHandle<string>();
      const { user } = renderWithUser(() => <App handle={handle} />);

      for (const name of ['Library', 'Playback', 'Sharing']) {
        const trigger = screen.getByRole('button', { name });
        // eslint-disable-next-line no-await-in-loop
        await user.click(trigger);
        // eslint-disable-next-line no-await-in-loop
        await expectOpenWith(name);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        // eslint-disable-next-line no-await-in-loop
        await user.click(screen.getByRole('menuitem'));
        // eslint-disable-next-line no-await-in-loop
        await expectClosed();
      }

      await user.click(screen.getByRole('button', { name: 'Library' }));
      await expectOpenWith('Library');
      await user.click(screen.getByRole('button', { name: 'Sharing' }));
      await expectOpenWith('Sharing');
      await user.click(screen.getByRole('button', { name: 'Sharing' }));
      await expectClosed();

      await user.click(screen.getByRole('button', { name: 'Open externally' }));
      await expectOpenWith('Playback');
      await user.keyboard('[Escape]');
      await expectClosed();

      await user.click(screen.getByRole('button', { name: 'Open via handle' }));
      await expectOpenWith('Playback');
      await user.click(screen.getByRole('menuitem'));
      await expectClosed();
    });
  });
});
