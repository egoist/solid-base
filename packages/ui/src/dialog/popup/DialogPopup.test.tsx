import { Errored, Show, createSignal } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Dialog } from '..';
import { AlertDialog } from '../../alert-dialog';
import { popupFocusPropsTests, renderWithUser } from '../test-utils';

describe('<Dialog.Popup />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'popup open' : 'popup')}
              style={{ color: 'red' }}
              render={(props, state) => (
                <section {...props} data-state-open={String(state.open)} />
              )}
            />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(ref).toBe(popup);
      expect(popup.tagName).toBe('SECTION');
      expect(popup).toHaveClass('popup', 'open');
      expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      // The internal style (`--nested-dialogs`) is merged with the user's.
      expect(popup.style.getPropertyValue('--nested-dialogs')).toBe('0');
      expect(popup).toHaveAttribute('data-state-open', 'true');
      expect(popup).toHaveAttribute('data-open');
    });

    it('renders a div by default', () => {
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      expect(screen.getByRole('dialog')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('throws a descriptive error when rendered outside <Dialog.Root>', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Dialog.Popup />
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>.',
    );
  });

  describe('prop: keepMounted', () => {
    it('should keep the dialog mounted when keepMounted=true', () => {
      render(() => (
        <Dialog.Root open={false} modal={false}>
          <Dialog.Portal keepMounted>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
      expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('hidden');
    });

    it.each([
      { name: 'false', keepMounted: false },
      { name: 'undefined', keepMounted: undefined },
    ])('should not keep the dialog mounted when keepMounted=$name', ({ keepMounted }) => {
      render(() => (
        <Dialog.Root open={false} modal={false}>
          <Dialog.Portal keepMounted={keepMounted}>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });
  });

  describe('prop: id', () => {
    it.each([
      {
        name: 'Dialog',
        role: 'dialog',
        element: () => (
          <Dialog.Root>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup id={undefined} />
            </Dialog.Portal>
          </Dialog.Root>
        ),
      },
      {
        name: 'AlertDialog',
        role: 'alertdialog',
        element: () => (
          <AlertDialog.Root>
            <AlertDialog.Trigger>Open</AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Popup id={undefined} />
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ),
      },
    ])('keeps the generated id when undefined ($name)', async ({ role, element }) => {
      const { user } = renderWithUser(element);

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const popup = await screen.findByRole(role);
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });

  // A modal dialog traps focus and marks the rest of the page inert, so it resolves the focus props
  // through a different path than a non-modal one.
  describe('modal', () => {
    popupFocusPropsTests({
      createComponent: (props) => (
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup initialFocus={props.initialFocus} finalFocus={props.finalFocus}>
              {props.children()}
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    });
  });

  describe('non-modal', () => {
    popupFocusPropsTests({
      createComponent: (props) => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup initialFocus={props.initialFocus} finalFocus={props.finalFocus}>
              {props.children()}
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ),
    });
  });

  describe('prop: initialFocus', () => {
    it('focuses the popup itself rather than inner content when opened by touch', async () => {
      render(() => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="dialog">
              <input data-testid="input" />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const trigger = screen.getByText('Open');
      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger, { detail: 1 });

      // On touch the default focuses the popup to avoid opening the virtual keyboard.
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toHaveFocus();
      });
      expect(screen.getByTestId('input')).not.toHaveFocus();
    });
  });

  describe('display: contents ancestors', () => {
    it('keeps initial focus working when the popup is wrapped by a display: contents ancestor', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="outside-before">Outside before</button>
          <Dialog.Root modal={false}>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Portal>
              <form style={{ display: 'contents' }}>
                <Dialog.Popup data-testid="dialog-popup">
                  <input data-testid="dialog-input" />
                  <button type="button">Close</button>
                </Dialog.Popup>
              </form>
            </Dialog.Portal>
          </Dialog.Root>
          <button data-testid="outside-after">Outside after</button>
        </div>
      ));

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('dialog-input')).toHaveFocus();
      });
    });

    it('keeps trap-focus tab cycling inside the popup when wrapped by a display: contents ancestor', async () => {
      const { user } = renderWithUser(() => (
        <div>
          <button data-testid="outside-before">Outside before</button>
          <Dialog.Root defaultOpen modal="trap-focus">
            <Dialog.Portal>
              <form style={{ display: 'contents' }}>
                <Dialog.Popup data-testid="dialog-popup">
                  <input data-testid="first-input" />
                  <button type="button" data-testid="second-button">
                    Second
                  </button>
                </Dialog.Popup>
              </form>
            </Dialog.Portal>
          </Dialog.Root>
          <button data-testid="outside-after">Outside after</button>
        </div>
      ));

      const popup = screen.getByTestId('dialog-popup');

      await waitFor(() => {
        expect(screen.getByTestId('first-input')).toHaveFocus();
      });

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('second-button')).toHaveFocus();

      await user.keyboard('[Tab]');
      await waitFor(() => {
        expect(screen.getByTestId('first-input')).toHaveFocus();
      });
      expect(screen.getByTestId('outside-before')).not.toHaveFocus();
      expect(screen.getByTestId('outside-after')).not.toHaveFocus();

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      await waitFor(() => {
        expect(screen.getByTestId('second-button')).toHaveFocus();
      });
      expect(popup.contains(document.activeElement)).toBe(true);
    });
  });

  describe('prop: finalFocus', () => {
    it('respects finalFocus when initialFocus points outside the popup', async () => {
      function TestComponent() {
        const initialRef: { current: HTMLInputElement | null } = { current: null };
        const finalRef: { current: HTMLInputElement | null } = { current: null };
        return (
          <div>
            <input
              data-testid="initial-outside"
              ref={(el) => {
                initialRef.current = el;
              }}
            />
            <Dialog.Root>
              <Dialog.Backdrop />
              <Dialog.Trigger>Open</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup initialFocus={initialRef} finalFocus={finalRef}>
                  <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <input
              data-testid="final-outside"
              ref={(el) => {
                finalRef.current = el;
              }}
            />
          </div>
        );
      }

      const { user } = renderWithUser(() => <TestComponent />);

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('initial-outside')).toHaveFocus();
      });

      await user.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.getByTestId('final-outside')).toHaveFocus();
      });
    });

    it('moves final focus to trigger if initialFocus points outside the popup and finalFocus is not specified', async () => {
      function TestComponent() {
        const initialRef: { current: HTMLInputElement | null } = { current: null };
        return (
          <div>
            <input
              data-testid="initial-outside"
              ref={(el) => {
                initialRef.current = el;
              }}
            />
            <Dialog.Root>
              <Dialog.Backdrop />
              <Dialog.Trigger>Open</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup initialFocus={initialRef}>
                  <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <input data-testid="final-outside" />
          </div>
        );
      }

      const { user } = renderWithUser(() => <TestComponent />);

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('initial-outside')).toHaveFocus();
      });

      await user.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
      });
    });
  });

  // Select and Menu are not ported yet.
  describe.skip('return focus when opened from a popup item (requires Select/Menu)', () => {
    it('returns focus to the select trigger', () => {});
    it('returns focus to the keepMounted menu trigger', () => {});
    it('returns focus to the select (keepMounted dialog) trigger', () => {});
    it('returns focus to the keepMounted menu that pressing did not focus trigger', () => {});
  });

  // Popover is not ported yet.
  it.skip('does not return focus to the trigger of a popover that opened by default (requires Popover)', () => {});

  describe('nested dialog count', () => {
    it('provides the number of open nested dialogs as a CSS variable', async () => {
      const { user } = renderWithUser(() => (
        <Dialog.Root>
          <Dialog.Trigger>Trigger 0</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup0">
              <Dialog.Root>
                <Dialog.Trigger>Trigger 1</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="popup1">
                    <Dialog.Root>
                      <Dialog.Trigger>Trigger 2</Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="popup2">
                          <Dialog.Close>Close 2</Dialog.Close>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                    <Dialog.Close>Close 1</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      await user.click(screen.getByRole('button', { name: 'Trigger 0' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup0')).not.toBe(null);
      });

      const computedStyles = getComputedStyle(screen.getByTestId('popup0'));

      expect(computedStyles.getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup1')).not.toBe(null);
      });

      expect(getComputedStyle(screen.getByTestId('popup0')).getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Trigger 2' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup2')).not.toBe(null);
      });

      expect(getComputedStyle(screen.getByTestId('popup0')).getPropertyValue('--nested-dialogs')).toBe('2');

      await user.click(screen.getByRole('button', { name: 'Close 2' }));

      expect(getComputedStyle(screen.getByTestId('popup0')).getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Close 1' }));

      expect(getComputedStyle(screen.getByTestId('popup0')).getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('decrements the count when an open nested dialog is unmounted', async () => {
      function App() {
        const [showNested, setShowNested] = createSignal(true);
        return (
          <>
            <button onClick={() => setShowNested(!showNested())}>toggle</button>
            <Dialog.Root>
              <Dialog.Trigger>Trigger 0</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup data-testid="popup0">
                  <Show when={showNested()}>
                    <Dialog.Root>
                      <Dialog.Trigger>Trigger 1</Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="popup1">
                          <Dialog.Close>Close 1</Dialog.Close>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                  </Show>
                  <Dialog.Close>Close 0</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Trigger 0' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup0')).not.toBe(null);
      });

      const popup0 = screen.getByTestId('popup0');
      expect(getComputedStyle(popup0).getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup1')).not.toBe(null);
      });

      expect(getComputedStyle(popup0).getPropertyValue('--nested-dialogs')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'toggle', hidden: true }));

      expect(getComputedStyle(popup0).getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('does not change the count when a closed nested dialog is unmounted', async () => {
      function App() {
        const [showNested, setShowNested] = createSignal(true);
        return (
          <Dialog.Root>
            <Dialog.Trigger>Trigger 0</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup0">
                <Show when={showNested()}>
                  <Dialog.Root>
                    <Dialog.Trigger />
                    <Dialog.Portal>
                      <Dialog.Popup />
                    </Dialog.Portal>
                  </Dialog.Root>
                </Show>
                <button onClick={() => setShowNested(!showNested())}>toggle</button>
                <Dialog.Close>Close 0</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await user.click(screen.getByRole('button', { name: 'Trigger 0' }));

      await waitFor(() => {
        expect(screen.getByTestId('popup0')).not.toBe(null);
      });

      const popup0 = screen.getByTestId('popup0');
      expect(getComputedStyle(popup0).getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'toggle' }));

      expect(getComputedStyle(popup0).getPropertyValue('--nested-dialogs')).toBe('0');
    });

    it('increments for nested alert dialog and decrements on close (cross-type)', async () => {
      const { user } = renderWithUser(() => (
        <Dialog.Root>
          <Dialog.Trigger>Open Dialog</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent-dialog">
              <AlertDialog.Root>
                <AlertDialog.Trigger>Open Alert</AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Popup data-testid="nested-alert">
                    <AlertDialog.Close>Close Alert</AlertDialog.Close>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
              <Dialog.Close>Close Dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      await user.click(screen.getByRole('button', { name: 'Open Dialog' }));
      await waitFor(() => expect(screen.getByTestId('parent-dialog')).not.toBe(null));

      const parent = screen.getByTestId('parent-dialog');
      expect(getComputedStyle(parent).getPropertyValue('--nested-dialogs')).toBe('0');

      await user.click(screen.getByRole('button', { name: 'Open Alert' }));
      await waitFor(() => expect(screen.getByTestId('nested-alert')).not.toBe(null));
      await waitFor(() => {
        expect(getComputedStyle(parent).getPropertyValue('--nested-dialogs')).toBe('1');
      });

      await user.click(screen.getByRole('button', { name: 'Close Alert' }));
      await waitFor(() => {
        expect(getComputedStyle(parent).getPropertyValue('--nested-dialogs')).toBe('0');
      });
    });
  });

  describe('style hooks', () => {
    it('adds the `nested` and `nested-dialog-open` style hooks if a dialog has a parent dialog', () => {
      render(() => (
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent-dialog" />
            <Dialog.Root open>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested-dialog">
                  <Dialog.Root>
                    <Dialog.Portal>
                      <Dialog.Popup />
                    </Dialog.Portal>
                  </Dialog.Root>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const parentDialog = screen.getByTestId('parent-dialog');
      const nestedDialog = screen.getByTestId('nested-dialog');

      expect(parentDialog).not.toHaveAttribute('data-nested');
      expect(nestedDialog).toHaveAttribute('data-nested');

      expect(parentDialog).toHaveAttribute('data-nested-dialog-open');
      expect(nestedDialog).not.toHaveAttribute('data-nested-dialog-open');
    });

    it('adds the `nested` and `nested-dialog-open` style hooks if a dialog has a parent alert dialog', () => {
      render(() => (
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <AlertDialog.Popup data-testid="parent-dialog" />
            <Dialog.Root open>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested-dialog">
                  <Dialog.Root>
                    <Dialog.Portal>
                      <Dialog.Popup />
                    </Dialog.Portal>
                  </Dialog.Root>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      ));

      const parentDialog = screen.getByTestId('parent-dialog');
      const nestedDialog = screen.getByTestId('nested-dialog');

      expect(parentDialog).not.toHaveAttribute('data-nested');
      expect(nestedDialog).toHaveAttribute('data-nested');

      expect(parentDialog).toHaveAttribute('data-nested-dialog-open');
      expect(nestedDialog).not.toHaveAttribute('data-nested-dialog-open');
    });
  });
});
