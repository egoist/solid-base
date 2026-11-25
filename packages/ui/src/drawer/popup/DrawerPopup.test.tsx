/*
 * Browser-only upstream (skipIf(isJSDOM)), not ported:
 * - includes border size in frontmost height CSS variable for nested drawers
 * - clears parent nested drawer state when a nested drawer starts closing before unmount
 * - keeps a fixed height applied while a nested drawer closes
 * - restores a fixed height before nested state when reopening a nested drawer
 */
import { Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { reset as resetLoggedErrors } from '@egoist/solid-base-utils/error';
import { Drawer } from '..';
import { Dialog } from '../../dialog';
import { AlertDialog } from '../../alert-dialog';
import { act, renderWithProps, renderWithUser } from '../../dialog/test-utils';
import { useDrawerRootContext } from '../root/DrawerRootContext';

function setHeight(element: HTMLElement | null, getValue: () => number) {
  if (element) {
    Object.defineProperty(element, 'offsetHeight', { configurable: true, get: getValue });
  }
}

function PopupHeightProbe() {
  const drawer = useDrawerRootContext();

  return (
    <>
      <output data-testid="popup-height">{drawer.popupHeight}</output>
      <button onClick={() => drawer.onNestedFrontmostHeightChange(200)}>
        Report nested height
      </button>
    </>
  );
}

function stubResizeObserver() {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  const OriginalResizeObserver = globalThis.ResizeObserver;

  globalThis.ResizeObserver = class ResizeObserverStub {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback);
    }

    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  return {
    resizeCallbacks,
    restore() {
      globalThis.ResizeObserver = OriginalResizeObserver;
    },
  };
}

const VIEWPORT_WARNING =
  'Base UI: <Drawer.Popup> expected to be rendered within <Drawer.Viewport>. ' +
  'Omitting the viewport disables drawer swipe handling and touch scroll locking. ' +
  'Wrap <Drawer.Popup> in <Drawer.Viewport>.';

describe('<Drawer.Popup />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup
                ref={(el) => {
                  ref = el;
                }}
                class={(state) => (state.open ? 'popup open' : 'popup')}
                style={{ color: 'red' }}
                render={(props, state) => (
                  <section {...props} data-state-open={String(state.open)} />
                )}
              />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      const popup = screen.getByRole('dialog');
      expect(ref).toBe(popup);
      expect(popup.tagName).toBe('SECTION');
      expect(popup).toHaveClass('popup', 'open');
      expect(popup).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      // The internal style is merged with the user's.
      expect(popup.style.getPropertyValue('--nested-drawers')).toBe('0');
      expect(popup).toHaveAttribute('data-state-open', 'true');
      expect(popup).toHaveAttribute('data-open');
      expect(popup).toHaveAttribute('data-swipe-direction', 'down');
    });

    it('renders a div by default', () => {
      render(() => (
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      expect(screen.getByRole('dialog')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('warns in development when not rendered within a viewport', async () => {
    resetLoggedErrors();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: <Drawer.Popup> expected to be rendered within <Drawer.Viewport>.',
          ),
        );
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  // Upstream: "warns without relying on React owner-stack support". There is no owner stack in
  // Solid; this checks the exact message instead.
  it('warns with the exact message', async () => {
    resetLoggedErrors();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(VIEWPORT_WARNING);
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('defaults initial focus to the popup element', async () => {
    render(() => (
      <div>
        <input />
        <Drawer.Root modal={false}>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">
                <input data-testid="popup-input" />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));

    await act(async () => {
      screen.getByRole('button', { name: 'Open' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
    expect(screen.getByTestId('popup-input')).not.toHaveFocus();
  });

  it('leaves focus on the trigger when initial focus is disabled', async () => {
    const { user } = renderWithUser(() => (
      <Drawer.Root modal={false}>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup initialFocus={false}>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
    expect(trigger).toHaveFocus();
  });

  it('stops composite navigation keys from escaping the popup', () => {
    const handleKeyDown = vi.fn();
    render(() => (
      <div onKeyDown={handleKeyDown}>
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <input aria-label="Field" />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));

    const field = screen.getByRole('textbox', { name: 'Field' });
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(handleKeyDown).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: 'a' });
    expect(handleKeyDown).toHaveBeenCalled();
  });

  describe('prop: id', () => {
    it('sets a custom id that the trigger controls', async () => {
      const { user } = renderWithUser(() => (
        <Drawer.Root>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup id="custom-popup" />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      expect(await screen.findByRole('dialog')).toHaveAttribute('id', 'custom-popup');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup');
    });

    it('keeps the generated id when undefined', async () => {
      const { user } = renderWithUser(() => (
        <Drawer.Root>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup id={undefined} />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const popup = await screen.findByRole('dialog');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });

  it('applies a negative snap point offset to upward drawers', async () => {
    render(() => (
      <Drawer.Root
        defaultSnapPoint="100px"
        open
        modal={false}
        snapPoints={['100px', '300px']}
        swipeDirection="up"
      >
        <Drawer.Portal>
          <Drawer.Viewport ref={(element) => setHeight(element, () => 400)}>
            <Drawer.Popup data-testid="popup" ref={(element) => setHeight(element, () => 300)}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe(
        '-200px',
      );
    });
    expect(screen.getByTestId('popup')).toHaveAttribute('data-swipe-direction', 'up');
  });

  it('keeps the last measured popup height while nested content stretches it', async () => {
    const stub = stubResizeObserver();
    let popupHeight = 100;

    try {
      const { user } = renderWithUser(() => (
        <Drawer.Root open modal={false}>
          <PopupHeightProbe />
          <Drawer.Portal>
            <Drawer.Viewport ref={(element) => setHeight(element, () => 400)}>
              <Drawer.Popup ref={(element) => setHeight(element, () => popupHeight)}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('popup-height').textContent).toBe('100');
      });

      await user.click(screen.getByRole('button', { name: 'Report nested height' }));
      popupHeight = 150;
      await act(async () => {
        stub.resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
      });

      expect(screen.getByTestId('popup-height').textContent).toBe('100');
    } finally {
      stub.restore();
    }
  });

  it('does not throw when a popup render function produces no element', () => {
    expect(() =>
      render(() => (
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup render={() => null as any}>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      )),
    ).not.toThrow();
  });

  it('ignores a queued measurement after the popup unmounts', async () => {
    const stub = stubResizeObserver();

    try {
      const { setProps } = renderWithProps(
        (props: { showPopup: boolean }) => (
          <Drawer.Root open modal={false}>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Show when={props.showPopup}>
                  <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
                </Show>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        ),
        { showPopup: true },
      );
      await act(() => {});
      expect(screen.getByTestId('popup')).toBeVisible();
      const callbacks = stub.resizeCallbacks.slice();

      await setProps({ showPopup: false });
      expect(screen.queryByTestId('popup')).toBe(null);

      await expect(
        act(async () => {
          callbacks.forEach((callback) => callback([], {} as ResizeObserver));
        }),
      ).resolves.toBeUndefined();
    } finally {
      stub.restore();
    }
  });

  // Upstream also asserts that the child reports before React's passive effects flush; Solid has
  // no passive effect phase, so only the resulting parent state is checked.
  it('reports nested presence and frontmost height to the parent drawer', async () => {
    const { setProps } = renderWithProps(
      (props: { childOpen: boolean }) => (
        <Drawer.Root defaultOpen modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root open={props.childOpen} modal={false}>
                  <Drawer.Portal keepMounted>
                    <Drawer.Viewport>
                      <Drawer.Popup
                        initialFocus={false}
                        ref={(element) => {
                          Object.defineProperty(element, 'offsetHeight', {
                            configurable: true,
                            value: 100,
                          });
                        }}
                      >
                        Child drawer
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ),
      { childOpen: false },
    );

    await setProps({ childOpen: true });

    const parentPopup = screen.getByTestId('parent-popup');
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
    expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).toBe('100px');
  });

  it('keeps the parent nested state when a closed handle-backed nested drawer mounts', async () => {
    const handle = Drawer.createHandle();

    render(() => (
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup>Open child</Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
              {/* Must come after the open sibling so its effect runs last. */}
              <Drawer.Root handle={handle} modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup>Closed child</Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open');
    });
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
  });

  it('does not treat dialogs inside nested drawers as nested drawers', async () => {
    render(() => (
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <Dialog.Root modal={false}>
                        <Dialog.Trigger>Open dialog</Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Popup data-testid="dialog-popup">Dialog</Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const observedNestedDrawerCounts = [parentPopup.style.getPropertyValue('--nested-drawers')];

    const observer = new MutationObserver(() => {
      observedNestedDrawerCounts.push(parentPopup.style.getPropertyValue('--nested-drawers'));
    });

    observer.observe(parentPopup, {
      attributeFilter: ['style'],
      attributes: true,
    });

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    await act(async () => {
      screen.getByRole('button', { name: 'Open dialog' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog-popup')).toBeVisible();
    });
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    observer.disconnect();

    expect(observedNestedDrawerCounts).not.toContain('2');
  });

  it('does not treat alert dialogs inside nested drawers as nested drawers', async () => {
    render(() => (
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>Open alert dialog</AlertDialog.Trigger>
                        <AlertDialog.Portal>
                          <AlertDialog.Popup data-testid="alert-dialog-popup">
                            Alert dialog
                            <AlertDialog.Close>Close alert dialog</AlertDialog.Close>
                          </AlertDialog.Popup>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const observedNestedDrawerCounts = [parentPopup.style.getPropertyValue('--nested-drawers')];

    const observer = new MutationObserver(() => {
      observedNestedDrawerCounts.push(parentPopup.style.getPropertyValue('--nested-drawers'));
    });

    observer.observe(parentPopup, {
      attributeFilter: ['style'],
      attributes: true,
    });

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    await act(async () => {
      screen.getByRole('button', { name: 'Open alert dialog' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-dialog-popup')).toBeVisible();
    });
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    observer.disconnect();

    expect(observedNestedDrawerCounts).not.toContain('2');
  });

  it('clears parent nested drawer state as soon as a nested drawer closes', async () => {
    render(() => (
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root modal={false}>
                <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                <Drawer.Portal keepMounted>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <Drawer.Close>Close nested drawer</Drawer.Close>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');

    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');

    await act(async () => {
      screen.getByRole('button', { name: 'Open nested drawer' }).click();
    });

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');

    await act(async () => {
      screen.getByRole('button', { name: 'Close nested drawer' }).click();
    });

    expect(childPopup).toBeInTheDocument();
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
  });
});
