import { Errored, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { Dialog } from '../../dialog';
import { ToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import type { InteractionType } from '../../utils/popups/interactions/enhancedClickHandler';
import type { FocusTargetProp } from '../../utils/popups/focus/FloatingFocusManager';
import {
  act,
  createRef,
  flushMicrotasks,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../test-utils';

describe('<Menu.Popup />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'popup open' : 'popup')}
                style={{ color: 'red' }}
                render={(props, state) => (
                  <section {...props} data-state-nested={String(state.nested)} />
                )}
              />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const popup = screen.getByRole('menu');
      expect(ref).toBe(popup);
      expect(popup.tagName).toBe('SECTION');
      expect(popup).toHaveClass('popup', 'open');
      expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(popup).toHaveAttribute('data-state-nested', 'false');
      expect(popup).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const popup = screen.getByRole('menu');
      expect(popup).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('throws when rendered outside Menu.Positioner', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.Root open>
          <Menu.Popup />
        </Menu.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.',
    );
  });

  it('uses an aria-label instead of the trigger label', () => {
    render(() => (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup aria-label="Commands" />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const popup = screen.getByRole('menu', { name: 'Commands' });
    expect(popup).not.toHaveAttribute('aria-labelledby');
  });

  it('uses aria-labelledby from a render element', () => {
    render(() => (
      <Menu.Root open>
        <span id="commands-label">Commands</span>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup
              render={(props) => <section {...props} aria-labelledby="commands-label" />}
            />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    expect(screen.getByRole('menu', { name: 'Commands' })).toHaveAttribute(
      'aria-labelledby',
      'commands-label',
    );
  });

  it('stops toolbar navigation keys without blocking ordinary key events', () => {
    const onParentKeyDown = vi.fn();

    render(() => (
      <ToolbarRootContext value={{ disabled: false, orientation: 'horizontal' }}>
        <div onKeyDown={onParentKeyDown}>
          <Menu.Root>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </ToolbarRootContext>
    ));

    const popup = screen.getByTestId('popup');
    fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' }),
    );
    expect(onParentKeyDown).not.toHaveBeenCalled();

    fireEvent(popup, new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F1' }));
    expect(onParentKeyDown).toHaveBeenCalled();
    expect(onParentKeyDown.mock.calls.every(([event]) => event.key === 'F1')).toBe(true);
  });

  it('enters the items at the list boundary when an arrow key leaves custom popup content', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <button type="button">Custom</button>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const one = await screen.findByRole('menuitem', { name: 'One' });
    // The focus manager moves focus into the popup on the next frame after a pointer open.
    await waitFor(() =>
      expect(screen.getByRole('menu')).toContainElement(document.activeElement as HTMLElement),
    );
    await act(() => one.focus());
    await user.keyboard('[ArrowDown]');
    // Mid-list, so continuing from the highlight would reach Three instead.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());

    await act(() => screen.getByRole('button', { name: 'Custom' }).focus());
    await user.keyboard('[ArrowDown]');

    await waitFor(() => expect(one).toHaveFocus());
  });

  it('moves focus into the items when the boundary item is already highlighted', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <a href="#profile">Profile</a>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await act(() => screen.getByRole('button', { name: 'Open' }).focus());
    await user.keyboard('[Enter]');

    const one = await screen.findByRole('menuitem', { name: 'One' });
    await waitFor(() => expect(one).toHaveAttribute('data-highlighted'));
    await act(() => screen.getByRole('link', { name: 'Profile' }).focus());
    expect(one).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(one).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
  });

  it('moves focus into the items when the last item is already highlighted', async () => {
    const { user } = renderWithUser(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <a href="#profile">Profile</a>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await act(() => screen.getByRole('button', { name: 'Open' }).focus());
    await user.keyboard('[ArrowUp]');

    const three = await screen.findByRole('menuitem', { name: 'Three' });
    await waitFor(() => expect(three).toHaveAttribute('data-highlighted'));
    // Let the keyboard open's initial focus land before moving focus elsewhere in the popup.
    await waitFor(() => expect(three).toHaveFocus());
    await act(() => screen.getByRole('link', { name: 'Profile' }).focus());
    expect(three).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowUp]');
    await waitFor(() => expect(three).toHaveFocus());

    await user.keyboard('[ArrowUp]');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
  });

  it.each([
    { name: 'its trigger', live: false },
    // Live regions outside a modal stay exposed to assistive tech.
    { name: 'its trigger in a live region', live: true },
  ])(
    'does not move focus behind a modal dialog to $name when an item hides the menu trigger',
    async ({ live }) => {
      function App() {
        const [step, setStep] = createSignal(1);
        const dialogTrigger = () => <Dialog.Trigger>Create</Dialog.Trigger>;
        return (
          <Dialog.Root>
            {live ? <div aria-live="polite">{dialogTrigger()}</div> : dialogTrigger()}
            <Dialog.Portal>
              <Dialog.Popup>
                <div hidden={step() !== 1}>
                  <Menu.Root>
                    <Menu.Trigger>Template</Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Item onClick={() => setStep(2)}>Blank</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const dialogTrigger = screen.getByRole('button', { name: 'Create' });
      await user.click(dialogTrigger);
      await user.click(await screen.findByRole('button', { name: 'Template' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Blank' }));

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Blank' })).toBe(null);
      });
      await flushMicrotasks();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(dialogTrigger).not.toHaveFocus();
    },
  );

  it('keeps focus on an input that autofocuses when the trigger is hidden as the menu closes', async () => {
    function App() {
      const [renaming, setRenaming] = createSignal(false);
      let renameRequested = false;
      return (
        <div>
          <Menu.Root>
            <Menu.Trigger>Other</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          {renaming() && <input aria-label="Name" autofocus />}
          <Menu.Root
            onOpenChangeComplete={(open) => {
              if (!open && renameRequested) {
                renameRequested = false;
                setRenaming(true);
              }
            }}
          >
            <Menu.Trigger hidden={renaming()}>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item
                    onClick={() => {
                      renameRequested = true;
                    }}
                  >
                    Rename
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    }

    const { user } = renderWithUser(() => <App />);
    // Leaves the other trigger in the return-focus history.
    await user.click(screen.getByRole('button', { name: 'Other' }));
    await screen.findByRole('menuitem', { name: 'Item' });
    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Item' })).toBe(null);
    });

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));

    const input = await screen.findByRole('textbox', { name: 'Name' });
    // Solid has no `autoFocus` emulation: jsdom honours `autofocus` only on page load, so the
    // input is focused the way a browser would when it is inserted.
    await act(() => input.focus());
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    });
    await flushMicrotasks();
    expect(input).toHaveFocus();
  });

  // Port of upstream `popupFocusPropsTests` (Menu has no `initialFocus` prop, so only the
  // `finalFocus` part applies).
  describe('popup focus props', () => {
    type FocusTargets = {
      outside: { current: HTMLInputElement | null };
      inside: { current: HTMLInputElement | null };
    };
    type PopupFocusPropFactory =
      | boolean
      | undefined
      | ((targets: FocusTargets) => FocusTargetProp | undefined);

    function Test(props: { finalFocus?: PopupFocusPropFactory }) {
      const outsideRef = createRef<HTMLInputElement>();
      const insideRef = createRef<HTMLInputElement>();
      const targets: FocusTargets = { outside: outsideRef, inside: insideRef };
      const resolve = (value: PopupFocusPropFactory) =>
        typeof value === 'function' ? value(targets) : value;
      const finalFocus = resolve(props.finalFocus);

      return (
        <div>
          <input data-testid="outside-before" />
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup finalFocus={finalFocus}>
                  <Menu.Item>Close</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <input
            data-testid="outside-target"
            ref={(el) => {
              outsideRef.current = el;
            }}
          />
        </div>
      );
    }

    const getTrigger = () => screen.getByRole('button', { name: 'Open' });

    function expectClosed() {
      expect(screen.queryByText('Close')).toBe(null);
    }

    async function closeWithPointer(user: ReturnType<typeof renderWithUser>['user']) {
      await user.click(await screen.findByText('Close'));
    }

    describe('prop: finalFocus', () => {
      it('focuses the trigger by default', async () => {
        const { user } = renderWithUser(() => <Test />);

        await user.click(getTrigger());
        await closeWithPointer(user);

        await waitFor(() => {
          expect(getTrigger()).toHaveFocus();
        });
      });

      it('focuses the element of a ref', async () => {
        const { user } = renderWithUser(() => <Test finalFocus={({ outside }) => outside} />);

        await user.click(getTrigger());
        await closeWithPointer(user);

        await waitFor(() => {
          expect(screen.getByTestId('outside-target')).toHaveFocus();
        });
      });

      it.each([
        {
          name: 'an element',
          returns: ({ outside }: FocusTargets) => outside.current,
          getFocused: () => screen.getByTestId('outside-target'),
        },
        // `true` and `null` keep the default target, so the spy proves the function was consulted.
        { name: 'true', returns: () => true, getFocused: getTrigger },
        { name: 'null', returns: () => null, getFocused: getTrigger },
      ])(
        'focuses the right element when a function returns $name',
        async ({ returns, getFocused }) => {
          const finalFocusSpy = vi.fn();
          const { user } = renderWithUser(() => (
            <Test
              finalFocus={(targets) => (closeType: InteractionType) => {
                finalFocusSpy(closeType);
                return returns(targets);
              }}
            />
          ));

          await user.click(getTrigger());
          await closeWithPointer(user);

          await waitFor(() => {
            expect(getFocused()).toHaveFocus();
          });
          expect(finalFocusSpy).toHaveBeenCalledTimes(1);
        },
      );

      it('does not move focus when `false`', async () => {
        const { user } = renderWithUser(() => <Test finalFocus={false} />);

        await user.click(getTrigger());
        await closeWithPointer(user);
        await waitFor(() => {
          expectClosed();
        });
        await act(() => waitSingleFrame());

        expect(getTrigger()).not.toHaveFocus();
        // The focused close control was removed, so focus falls back to the body.
        expect(document.body).toHaveFocus();
      });

      it('passes the close type to a function', async () => {
        const finalFocusSpy = vi.fn();

        const { user } = renderWithUser(() => (
          <Test
            finalFocus={({ outside }) => (closeType: InteractionType) => {
              finalFocusSpy(closeType);
              return closeType === 'keyboard' ? outside.current : true;
            }}
          />
        ));

        const trigger = getTrigger();

        await user.click(trigger);
        // user-event's synthetic clicks carry no pointer type, so the mouse press is dispatched
        // directly.
        const close = await screen.findByText('Close');
        fireEvent.pointerDown(close, { pointerType: 'mouse' });
        fireEvent.click(close, { detail: 1 });
        await waitFor(() => {
          expectClosed();
        });
        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
        expect(finalFocusSpy).toHaveBeenNthCalledWith(1, 'mouse');

        await user.click(trigger);
        await screen.findByText('Close');
        await act(() => waitSingleFrame());
        await user.keyboard('[Escape]');
        await waitFor(() => {
          expect(screen.getByTestId('outside-target')).toHaveFocus();
        });
        expect(finalFocusSpy).toHaveBeenNthCalledWith(2, 'keyboard');
        expect(finalFocusSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('prop: finalFocus', () => {
    it('receives the interaction type of the item press that closed the menu', async () => {
      const finalFocus = vi.fn(() => true);

      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup finalFocus={finalFocus}>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByText('Open');

      await user.click(trigger);
      const item = await screen.findByText('Close');
      fireEvent.pointerDown(item, { pointerType: 'mouse' });
      fireEvent.click(item, { detail: 1 });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocus).toHaveBeenLastCalledWith('mouse');

      await user.keyboard('{Enter}');
      const reopenedItem = await screen.findByText('Close');
      // A keyboard open focuses the highlighted item on the next frame.
      await waitFor(() => expect(reopenedItem).toHaveFocus());
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
    });

    it('receives the mouse interaction type after a drag-release item selection', async () => {
      const finalFocus = vi.fn(() => true);

      render(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup finalFocus={finalFocus}>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByText('Open');
      fireEvent.mouseDown(trigger);
      const item = await screen.findByText('Close');

      // Drag-release selection is only armed 200ms after the trigger press.
      await act(() => wait(200));
      fireEvent.mouseUp(item);

      await waitFor(() => {
        expect(screen.queryByText('Close')).toBe(null);
      });
      expect(finalFocus).toHaveBeenLastCalledWith('mouse');
    });
  });
});
