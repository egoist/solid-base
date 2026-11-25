import { Show, createSignal, flush, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Tooltip } from '..';
import { OPEN_DELAY } from '../utils/constants';
import { REASONS } from '../../internals/reasons';
import {
  act,
  flushMicrotasks,
  renderWithProps,
  renderWithUser,
} from '../../dialog/test-utils';

/**
 * Advances the fake clock and flushes Solid's queued updates (upstream's `clock.tick`).
 */
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

/**
 * Hovers a trigger with a mouse the way upstream's tests do: `pointerdown` records the pointer
 * type, then `mouseenter` and `mousemove` start the open delay.
 */
function hoverWithMouse(trigger: HTMLElement, pointerType = 'mouse') {
  fireEvent.pointerDown(trigger, { pointerType });
  fireEvent.mouseEnter(trigger);
  fireEvent.mouseMove(trigger);
}

describe('<Tooltip.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  afterEach(async () => {
    await act(async () => {
      document.body.click();
    });
  });

  it('keeps the payload while a controlled reopen moves to another trigger', async () => {
    const handle = Tooltip.createHandle<string>();
    const payloads: Array<string | undefined> = [];
    const [state, setState] = createSignal<{ open: boolean; triggerId: string | null }>({
      open: true,
      triggerId: 'first',
    });

    function record(payload: string | undefined) {
      payloads.push(payload);
      return payload;
    }

    render(() => (
      <>
        <Tooltip.Trigger handle={handle} id="first" payload="First">
          First
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="second" payload="Second">
          Second
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} open={state().open} triggerId={state().triggerId}>
          {(root: { payload: string | undefined }) => (
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>{record(root.payload)}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </>
    ));
    await flushMicrotasks();

    await act(() => setState({ open: false, triggerId: null }));

    payloads.length = 0;
    await act(() => setState({ open: true, triggerId: 'second' }));

    expect(payloads).not.toContain(undefined);
    expect(payloads.at(-1)).toBe('Second');
  });

  it('marks the popup data-instant dismiss when Escape closes it', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger delay={0}>Toggle</Tooltip.Trigger>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    const trigger = screen.getByRole('button', { name: 'Toggle' });

    // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab' });
      trigger.focus();
    });
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
    });

    fireEvent.keyDown(trigger, { key: 'Escape' });
    flush();

    await waitFor(() => {
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
    });
    expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
  });

  describe('trigger unmount during the open delay', () => {
    useFakeTimers();

    function ContainedApp(props: { showTrigger: boolean }) {
      return (
        <Tooltip.Root>
          <Show when={props.showTrigger}>
            <Tooltip.Trigger>Toggle</Tooltip.Trigger>
          </Show>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    function DetachedApp(props: { showTrigger: boolean }) {
      const handle = Tooltip.createHandle();
      return (
        <>
          <Show when={props.showTrigger}>
            <Tooltip.Trigger handle={handle}>Toggle</Tooltip.Trigger>
          </Show>
          <Tooltip.Root handle={handle}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </>
      );
    }

    it.each([
      { name: 'contained trigger', App: ContainedApp },
      { name: 'detached trigger', App: DetachedApp },
    ])('does not open once the hovered $name has unmounted', async ({ App }) => {
      const { setProps } = renderWithProps((props: { showTrigger: boolean }) => <App {...props} />, {
        showTrigger: true,
      });

      const trigger = screen.getByRole('button', { name: 'Toggle' });

      hoverWithMouse(trigger);

      tick(1);

      await setProps({ showTrigger: false });

      tick(OPEN_DELAY);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);
    });
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerTooltip },
    { name: 'detached triggers', Component: DetachedTriggerTooltip },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersTooltip },
  ])('when using $name', ({ Component: TestTooltip }) => {
    describe('uncontrolled open', () => {
      useFakeTimers();

      it('should open when the trigger is hovered', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('does not open when a touch pointer hovers the trigger', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger, 'touch');

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();
        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger is focused', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
        await act(async () => {
          fireEvent.keyDown(document, { key: 'Tab' });
          trigger.focus();
        });

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is blurred', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        tick(OPEN_DELAY);
        await flushMicrotasks();

        await act(async () => {
          trigger.blur();
        });

        tick(OPEN_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('controlled open', () => {
      useFakeTimers();

      function ControlledApp(props: { handleChange: (open: boolean) => void }) {
        const [open, setOpen] = createSignal(false);
        return (
          <TestTooltip
            rootProps={{
              get open() {
                return open();
              },
              onOpenChange: (nextOpen) => {
                props.handleChange(open());
                setOpen(nextOpen);
              },
            }}
          />
        );
      }

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        render(() => <ControlledApp handleChange={handleChange} />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);
        flush();

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('does not call onOpenChange again when the trigger is re-hovered while open', async () => {
        const handleChange = vi.fn();

        render(() => <ControlledApp handleChange={handleChange} />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);

        // Hovering the already-open trigger again doesn't request another open.
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenNthCalledWith(1, false);
      });
    });

    describe('prop: defaultOpen', () => {
      it('closes when the trigger is unhovered after opening by default', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: delay', () => {
      useFakeTimers();

      it('should open after rest delay', async () => {
        render(() => <TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        tick(100);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: closeDelay', () => {
      useFakeTimers();

      it('should close after delay', async () => {
        render(() => <TestTooltip triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);
        flush();

        expect(screen.getByText('Content')).not.toBe(null);

        tick(100);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('preventUnmountOnClose()', () => {
      it('does not prevent unmounting on later closes', async () => {
        let preventNextClose = true;
        const { user } = renderWithUser(() => (
          <TestTooltip
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextClose) {
                  preventNextClose = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.hover(trigger);

        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the tooltip when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = renderWithUser(() => (
          <TestTooltip
            rootProps={{
              actionsRef,
              onOpenChange: (_open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await act(async () => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });

      it('closes the tooltip when the `close` method is called', async () => {
        const onOpenChange = vi.fn();
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = renderWithUser(() => (
          <TestTooltip rootProps={{ actionsRef, onOpenChange }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        await act(async () => actionsRef.current.close());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });

        expect(trigger).not.toHaveAttribute('data-popup-open');
        expect(onOpenChange).toHaveBeenLastCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.imperativeAction }),
        );
      });
    });

    // jsdom has no CSS animations/transitions or `getAnimations()`.
    describe.skip('animations', () => {
      it('toggles instant animations for adjacent tooltips only while opening', () => {});
      it('unmounts an exiting tooltip when another tooltip opens', () => {});
      it('inline opacity: 0 is removed before user CSS transitions run', () => {});
    });

    describe('prop: disabled', () => {
      it('should not open when disabled', async () => {
        render(() => <TestTooltip rootProps={{ disabled: true }} triggerProps={{ delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        await act(async () => trigger.focus());

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not open on focus when the trigger is disabled', async () => {
        render(() => <TestTooltip triggerProps={{ disabled: true, delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => trigger.focus());
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should close if open when becoming disabled', async () => {
        function App() {
          const [disabled, setDisabled] = createSignal(false);
          return (
            <div>
              <TestTooltip
                rootProps={{
                  defaultOpen: true,
                  get disabled() {
                    return disabled();
                  },
                }}
                triggerProps={{ delay: 0 }}
              />
              <button
                data-testid="disabled"
                onClick={() => {
                  setDisabled(true);
                }}
              />
            </div>
          );
        }

        render(() => <App />);

        expect(screen.queryByText('Content')).not.toBe(null);

        const disabledButton = screen.getByTestId('disabled');
        fireEvent.click(disabledButton);
        flush();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('reopens when re-enabled if the disabled close was canceled', async () => {
        const [disabled, setDisabled] = createSignal(false);

        render(() => (
          <TestTooltip
            rootProps={{
              defaultOpen: true,
              get disabled() {
                return disabled();
              },
              onOpenChange: (open, details) => {
                if (!open && details.reason === REASONS.disabled) {
                  details.cancel();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />
        ));
        expect(screen.queryByText('Content')).not.toBe(null);

        await act(() => setDisabled(true));
        expect(screen.queryByText('Content')).toBe(null);

        await act(() => setDisabled(false));
        expect(screen.queryByText('Content')).not.toBe(null);
      });

      it('does not report the open completion again when it toggles on a kept-mounted open tooltip', async () => {
        const onOpenChangeComplete = vi.fn();
        const { setProps } = renderWithProps(
          (props: { disabled: boolean }) => (
            <TestTooltip
              rootProps={{
                open: true,
                get disabled() {
                  return props.disabled;
                },
                onOpenChangeComplete,
              }}
              portalProps={{ keepMounted: true }}
            />
          ),
          { disabled: false },
        );
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
        });
        onOpenChangeComplete.mockClear();

        await setProps({ disabled: true });
        await setProps({ disabled: false });
        await flushMicrotasks();

        expect(onOpenChangeComplete).not.toHaveBeenCalledWith(true);
      });

      it('does not throw error when combined with defaultOpen', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true, disabled: true }} />);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('marks the trigger as disabled when the root is disabled', async () => {
        render(() => <TestTooltip rootProps={{ disabled: true }} />);

        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
          'data-trigger-disabled',
        );
      });

      it('keeps the tooltip disabled when the root is disabled and the trigger opts back in', async () => {
        const onOpenChange = vi.fn();
        render(() => (
          <TestTooltip
            rootProps={{ disabled: true, onOpenChange }}
            triggerProps={{ disabled: false, delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        expect(trigger).toHaveAttribute('data-trigger-disabled');

        hoverWithMouse(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
        expect(onOpenChange).not.toHaveBeenCalled();
      });
    });

    describe('prop: disableHoverablePopup', () => {
      it('applies pointer-events: none to the positioner when `disableHoverablePopup = true`', async () => {
        render(() => (
          <TestTooltip rootProps={{ disableHoverablePopup: true }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('none');
      });

      it('does not apply pointer-events: none to the positioner when `disableHoverablePopup = false`', async () => {
        render(() => (
          <TestTooltip rootProps={{ disableHoverablePopup: false }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('');
      });
    });

    describe('prop: trackCursorAxis', () => {
      it('makes the positioner inert when tracking both axes', async () => {
        render(() => (
          <TestTooltip rootProps={{ trackCursorAxis: 'both' }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('none');
      });

      it('keeps the positioner hoverable when tracking a single axis', async () => {
        render(() => <TestTooltip rootProps={{ trackCursorAxis: 'x' }} triggerProps={{ delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('');
      });
    });

    describe('instant animations', () => {
      it('marks the popup as instant when opened by focus, but not when opened by hover', async () => {
        render(() => <TestTooltip triggerProps={{ delay: 0, closeDelay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
        await act(async () => {
          fireEvent.keyDown(document, { key: 'Tab' });
          trigger.focus();
        });
        await flushMicrotasks();

        expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'focus');

        await act(async () => trigger.blur());
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        hoverWithMouse(trigger);
        flush();

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-instant');
      });
    });

    describe('BaseUIChangeEventDetails', () => {
      it('allowPropagation() prevents stopPropagation on Escape while still closing', async () => {
        const stopPropagationSpy = vi.spyOn(Event.prototype as any, 'stopPropagation');

        render(() => (
          <TestTooltip
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen && eventDetails.reason === REASONS.escapeKey) {
                  eventDetails.allowPropagation();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />
        ));

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });
        flush();

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });

        expect(stopPropagationSpy).toHaveBeenCalledTimes(0);
        stopPropagationSpy.mockRestore();
      });
    });

    describe('dismissal', () => {
      useFakeTimers();

      it('should close when Escape is pressed', async () => {
        const onOpenChange = vi.fn();
        render(() => (
          <TestTooltip rootProps={{ defaultOpen: true, onOpenChange }} triggerProps={{ delay: 0 }} />
        ));

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.escapeKey }),
        );
      });

      it('should not open when the trigger was clicked before delay duration', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(OPEN_DELAY / 2);

        fireEvent.click(trigger);

        tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not open when the trigger receives pointerdown before delay duration', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY / 2);

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

        tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger was clicked before delay duration and closeOnClick is false', async () => {
        render(() => <TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(OPEN_DELAY / 2);

        fireEvent.click(trigger);

        tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is clicked after delay duration', async () => {
        render(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(trigger);
        flush();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not close when the trigger is clicked after delay duration and closeOnClick is false', async () => {
        render(() => <TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(trigger);
        flush();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('reopens on hover after the trigger is clicked closed', async () => {
        render(() => <TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        hoverWithMouse(trigger);

        tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(trigger);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        // Re-enter with mouse events only. A fresh pointerenter can be missed
        // after the click-driven close, but hover should still work.
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const tooltip = Tooltip.createHandle();

      function App() {
        const [showRoot, setShowRoot] = createSignal(true);
        const [remountOpen, setRemountOpen] = createSignal(false);
        let preventNextUnmount = true;

        return (
          <>
            <Tooltip.Trigger handle={tooltip} id="trigger" delay={0}>
              Toggle
            </Tooltip.Trigger>
            <button type="button" onClick={() => tooltip.open('trigger')}>
              Open tooltip
            </button>
            <button type="button" onClick={() => tooltip.close()}>
              Close tooltip
            </button>
            <button type="button" onClick={() => setShowRoot(false)}>
              Unmount root
            </button>
            <button
              type="button"
              onClick={() => {
                setRemountOpen(true);
                setShowRoot(true);
              }}
            >
              Remount open
            </button>
            <Show when={showRoot()}>
              <Tooltip.Root
                handle={tooltip}
                defaultOpen={remountOpen()}
                defaultTriggerId="trigger"
                onOpenChange={(open, details) => {
                  if (!open && preventNextUnmount) {
                    preventNextUnmount = false;
                    details.preventUnmountOnClose();
                  }
                }}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner">
                    <Tooltip.Popup>Content</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Show>
          </>
        );
      }

      const { user } = renderWithUser(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(screen.getByRole('button', { name: 'Open tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).not.toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      flush();
      expect(screen.queryByTestId('positioner')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });
    });
  });

  // jsdom has no layout: cursor tracking positions can't be measured.
  it.skip('tracks the cursor on the first delayed hover when trackCursorAxis is x', () => {});
  // jsdom has no layout: cursor tracking positions can't be measured.
  it.skip('stops tracking the cursor after trackCursorAxis is disabled while closed', () => {});
  // jsdom has no layout: cursor tracking positions can't be measured.
  it.skip('updates the tracked cursor position after closing and reopening', () => {});

  // jsdom has no layout: cursor anchoring positions can't be measured.
  describe.skip('cursor anchor after a close', () => {
    it('anchors a reopen without a pointer to the last cursor position', () => {});
    it('keeps following the cursor while a kept-mounted tooltip is closed', () => {});
  });

  // jsdom has no layout: the safe polygon between the trigger and the popup can't be computed.
  describe.skip('hoverable popup', () => {
    it('survives the trip from the trigger to the popup, then closes after leaving it', () => {});
    it('closes on that same trip when `disableHoverablePopup` is set', () => {});
  });

  it('keeps the tooltip open when moving across spaced triggers without a closeDelay', async () => {
    const testTooltip = Tooltip.createHandle();
    const { user } = renderWithUser(() => (
      <Tooltip.Provider timeout={400}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 3
          </Tooltip.Trigger>
        </div>

        <Tooltip.Root handle={testTooltip}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const [trigger1, trigger2, trigger3] = screen.getAllByRole('button');

    await user.hover(trigger1);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    await user.unhover(trigger1);
    await user.hover(trigger2);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    fireEvent.mouseLeave(trigger2, { relatedTarget: document.body, clientX: 120, clientY: 0 });
    await user.hover(trigger3);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    fireEvent.mouseMove(document.body, { clientX: 300, clientY: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  });

  it('closes a tooltip that is still open when another tooltip in the group opens', async () => {
    const handleFirstOpenChange = vi.fn();
    const { user } = renderWithUser(() => (
      <Tooltip.Provider>
        <Tooltip.Root onOpenChange={handleFirstOpenChange}>
          <Tooltip.Trigger delay={0} closeDelay={10000}>
            First
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>First tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger delay={0}>Second</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Second tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    await user.hover(screen.getByRole('button', { name: 'First' }));
    await screen.findByText('First tooltip');
    // The close delay keeps the first tooltip open after the pointer leaves.
    await user.unhover(screen.getByRole('button', { name: 'First' }));
    expect(screen.queryByText('First tooltip')).not.toBe(null);

    await user.hover(screen.getByRole('button', { name: 'Second' }));
    await screen.findByText('Second tooltip');

    await waitFor(() => {
      expect(screen.queryByText('First tooltip')).toBe(null);
    });
    expect(handleFirstOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: REASONS.none }),
    );
  });

  describe('close requests', () => {
    it('reports the active trigger for an Escape close', async () => {
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Tooltip.Root defaultOpen onOpenChange={onOpenChange}>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      expect(screen.queryByText('Content')).not.toBe(null);

      await user.keyboard('[Escape]');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(
        screen.getByRole('button', { name: 'Trigger' }),
      );
    });
  });

  describe('hover changes', () => {
    it('commits a hover open while the hover event is dispatched', async () => {
      const popupPresentDuringEvent: boolean[] = [];
      render(() => (
        <Tooltip.Root>
          <Tooltip.Trigger delay={0}>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      function recordPopup() {
        popupPresentDuringEvent.push(screen.queryByText('Content') !== null);
      }

      // A listener added after the trigger's own runs once the tooltip has handled the event.
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      trigger.addEventListener('mouseenter', recordPopup);
      try {
        fireEvent.mouseEnter(trigger);
      } finally {
        trigger.removeEventListener('mouseenter', recordPopup);
      }

      expect(popupPresentDuringEvent).toEqual([true]);
    });

    // jsdom has no CSS animations: the close transition can't be observed.
    it.skip('reopens immediately when re-hovering the trigger during its close transition', () => {});
  });
});

describe('nested tooltips', () => {
  useFakeTimers();

  function NestedInner(props: {
    id?: string;
    label?: string;
    delay?: number;
    disabled?: boolean;
    render?: Tooltip.Trigger.Props['render'];
    withPopup?: boolean;
  }) {
    const id = () => props.id ?? 'inner';
    return (
      <Tooltip.Root>
        <Tooltip.Trigger
          data-testid={`${id()}-trigger`}
          delay={props.delay}
          disabled={props.disabled}
          render={props.render}
        >
          {props.label ?? 'Inner'}
        </Tooltip.Trigger>
        <Show when={props.withPopup !== false}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid={`${id()}-popup`}>{`${props.label ?? 'Inner'} tooltip`}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Show>
      </Tooltip.Root>
    );
  }

  function OuterPortal(props: { id?: string; children?: JSX.Element }) {
    return (
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup data-testid={`${props.id ?? 'outer'}-popup`}>
            {props.children ?? 'Outer tooltip'}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    );
  }

  /**
   * An outer tooltip whose span trigger wraps `outer-area` and a nested inner tooltip.
   */
  function NestedTooltips(props: {
    outerDelay?: number;
    outerDisabled?: boolean;
    innerDelay?: number;
  }) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger
          data-testid="outer-trigger"
          render="span"
          delay={props.outerDelay}
          disabled={props.outerDisabled}
        >
          <span data-testid="outer-area">Outer</span>
          <NestedInner delay={props.innerDelay} />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    );
  }

  it('should not open the outer tooltip when hovering over a nested tooltip trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <NestedInner />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 10, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open the outer tooltip when moving between sibling nested triggers', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <NestedInner id="inner-a" label="Inner A" />
          <NestedInner id="inner-b" label="Inner B" />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerATrigger = screen.getByTestId('inner-a-trigger');
    const innerBTrigger = screen.getByTestId('inner-b-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerATrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.mouseEnter(innerATrigger);
    fireEvent.mouseOver(innerATrigger);
    fireEvent.mouseMove(innerATrigger, { clientX: 30, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-a-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-b-popup')).toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerATrigger, { relatedTarget: innerBTrigger });
    fireEvent.pointerEnter(innerBTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerBTrigger);
    fireEvent.mouseOver(innerBTrigger);
    fireEvent.mouseMove(innerBTrigger, { clientX: 50, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-a-popup')).toBe(null);
    expect(screen.getByTestId('inner-b-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open ancestor tooltips when hovering over a third-level nested trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="grandparent-trigger" render="span">
          Grandparent
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="parent-trigger" render="span">
              Parent
              <NestedInner id="child" label="Child" />
            </Tooltip.Trigger>
            <OuterPortal id="parent">Parent tooltip</OuterPortal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <OuterPortal id="grandparent">Grandparent tooltip</OuterPortal>
      </Tooltip.Root>
    ));

    const grandparentTrigger = screen.getByTestId('grandparent-trigger');
    const parentTrigger = screen.getByTestId('parent-trigger');
    const childTrigger = screen.getByTestId('child-trigger');

    fireEvent.pointerEnter(grandparentTrigger, {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseEnter(grandparentTrigger);
    fireEvent.pointerEnter(parentTrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.mouseEnter(parentTrigger);
    fireEvent.pointerEnter(childTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(childTrigger);
    fireEvent.mouseOver(childTrigger);
    fireEvent.mouseMove(childTrigger, { clientX: 50, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('child-popup')).not.toBe(null);
    expect(screen.queryByTestId('parent-popup')).toBe(null);
    expect(screen.queryByTestId('grandparent-popup')).toBe(null);
  });

  it('should open the outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    render(() => <NestedTooltips outerDelay={0} />);

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should not open a disabled outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    render(() => <NestedTooltips outerDelay={0} outerDisabled />);

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should reopen the delayed outer tooltip when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    render(() => (
      <Tooltip.Provider delay={delay}>
        <NestedTooltips innerDelay={delay * 10} />
      </Tooltip.Provider>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  // Diverges: the outer trigger's rest timer, armed by the bubbling `mousemove` from the nested
  // trigger, still fires once the popup is open from outside and requests an open (`mousemove`).
  it.skip('should not re-announce an open outer tooltip when the pending reopen fires', async () => {
    const delay = 100;
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(false);

      return (
        <div>
          <button data-testid="open-outer" onClick={() => setOpen(true)} type="button" />
          <Tooltip.Provider delay={delay}>
            <Tooltip.Root
              open={open()}
              onOpenChange={(nextOpen, eventDetails) => {
                onOpenChange(nextOpen, eventDetails);
                setOpen(nextOpen);
              }}
            >
              <Tooltip.Trigger data-testid="outer-trigger" render="span">
                <span data-testid="outer-area">Outer</span>
                <NestedInner delay={delay * 10} />
              </Tooltip.Trigger>
              <OuterPortal />
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      );
    }

    render(() => <App />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    // Move back to the parent area so the local reopen is scheduled but not yet due.
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    // The tooltip is opened from the outside before the pending reopen fires.
    fireEvent.click(screen.getByTestId('open-outer'));
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('should support nested triggers inside a detached parent trigger', async () => {
    const delay = 100;
    const rowHandle = Tooltip.createHandle<string>();

    render(() => (
      <Tooltip.Provider delay={delay}>
        <Tooltip.Trigger handle={rowHandle} payload="Row" data-testid="outer-trigger" render="div">
          <span data-testid="outer-area">Row</span>
          <NestedInner delay={0} />
        </Tooltip.Trigger>

        <Tooltip.Root handle={rowHandle}>
          {(root: { payload: string | undefined }) => (
            <OuterPortal>{`${root.payload} tooltip`}</OuterPortal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).toHaveTextContent('Row tooltip');
  });

  it('should not reopen the outer tooltip when rapidly moving back to a nested trigger', async () => {
    const delay = 100;

    render(() => <NestedTooltips outerDelay={delay} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(delay);
    await flushMicrotasks();

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    tick(delay / 2);

    fireEvent.mouseOut(outerArea, { relatedTarget: innerTrigger });
    fireEvent.mouseOver(innerTrigger);

    tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not reopen the outer tooltip when hovering the nested tooltip popup', async () => {
    const delay = 100;

    render(() => <NestedTooltips outerDelay={delay} innerDelay={0} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(delay);
    await flushMicrotasks();

    const innerPopup = screen.getByTestId('inner-popup');
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOver(innerPopup);

    tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should cancel the pending parent reopen when the pointer leaves the parent trigger', async () => {
    const delay = 100;

    render(() => <NestedTooltips outerDelay={delay} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(delay);
    await flushMicrotasks();

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    tick(delay / 2);

    fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open the outer tooltip when the pointer moves onto a nested trigger before the delay expires', async () => {
    render(() => <NestedTooltips />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    tick(OPEN_DELAY / 2);

    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.pointerMove(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should restart the parent delay when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    render(() => <NestedTooltips outerDelay={delay} innerDelay={delay * 10} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    tick(delay / 2);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    tick(delay / 2);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should close the outer tooltip when the pointer moves from outer area onto a nested trigger', async () => {
    render(() => <NestedTooltips />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // First open the outer tooltip by hovering the outer area
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    // Now move onto the inner trigger — mouseover bubbles to the outer trigger,
    // which detects the nested trigger and closes itself.
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should keep a focus-opened outer tooltip open when hovering over a nested trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger
          data-testid="outer-trigger"
          render={(props) => <span tabindex={0} {...props} />}
        >
          <span>Outer</span>
          <NestedInner delay={OPEN_DELAY * 10} />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab' });
      outerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should keep a controlled-open outer tooltip open when hovering over a nested trigger', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <Tooltip.Root open onOpenChange={onOpenChange}>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span>Outer</span>
          <NestedInner delay={OPEN_DELAY * 10} />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('should not open the outer tooltip when focusing a nested tooltip trigger', async () => {
    render(() => (
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render="div">
            row label
            <NestedInner />
          </Tooltip.Trigger>
          <OuterPortal />
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');

    // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab' });
      innerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should close a focus-opened inner tooltip when the inner trigger loses focus', async () => {
    render(() => (
      <Tooltip.Provider delay={0}>
        <Tooltip.Root open={false}>
          <Tooltip.Trigger data-testid="outer-trigger" render="div">
            row label
            <NestedInner />
            <button data-testid="after">button</button>
          </Tooltip.Trigger>
          <OuterPortal />
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');
    const after = screen.getByTestId('after');

    // jsdom doesn't match `:focus-visible` on programmatic focus; a keyboard focus does.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Tab' });
      innerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);

    await act(async () => {
      after.focus();
    });
    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should allow the parent tooltip to open when a nested trigger is disabled', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <NestedInner label="Inner (disabled)" disabled />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    // The outer tooltip should open since the nested trigger is disabled
    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should not open the outer tooltip when hovering over a nested trigger inside a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    try {
      render(
        () => (
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="outer-trigger" render="span">
              Outer
              <NestedInner render="div" />
            </Tooltip.Trigger>
            <OuterPortal />
          </Tooltip.Root>
        ),
        { container },
      );

      const outerTrigger = shadowRoot.querySelector('[data-testid="outer-trigger"]') as HTMLElement;
      const innerTrigger = shadowRoot.querySelector('[data-testid="inner-trigger"]') as HTMLElement;
      const innerShadowRoot = innerTrigger.attachShadow({ mode: 'open' });
      const innerShadowTarget = document.createElement('span');
      innerShadowTarget.textContent = 'Inner shadow target';
      innerShadowRoot.appendChild(innerShadowTarget);

      // Hover the outer trigger first so the outer tooltip starts its open delay.
      fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
      fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
      fireEvent.mouseEnter(outerTrigger);
      fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

      // Move onto a target inside the inner trigger's shadow root before the delay expires.
      fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
      fireEvent.mouseEnter(innerTrigger);
      innerShadowTarget.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          composed: true,
          clientX: 50,
          clientY: 10,
        }),
      );
      fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

      tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('outer-popup')).toBe(null);
    } finally {
      await act(async () => {
        host.remove();
      });
    }
  });

  it('falls back to the event target when the composed path is empty', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <NestedInner withPopup={false} />
        </Tooltip.Trigger>
        <OuterPortal />
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Start the outer open delay so only nested trigger detection keeps it closed.
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger);

    // `composedPath()` is empty once an event has finished dispatching.
    const mouseOverEvent = new MouseEvent('mouseover', { bubbles: true, composed: true });
    Object.defineProperty(mouseOverEvent, 'composedPath', { value: () => [] });
    innerTrigger.dispatchEvent(mouseOverEvent);

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should open the outer tooltip when hovering over the non-nested area', async () => {
    render(() => <NestedTooltips />);

    const outerTrigger = screen.getByTestId('outer-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should not reopen the outer tooltip via the local reopen path for touch pointers', async () => {
    render(() => <NestedTooltips outerDelay={0} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // A touch interaction sets the pointer type to 'touch'.
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'touch', clientX: 50, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    // Move from the inner trigger back to the outer area; the local reopen
    // path is gated on `isMouseLikePointerType`, so a touch pointer must not
    // queue or fire a reopen.
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should allow mouse hover after leaving a touch interaction', async () => {
    render(() => <NestedTooltips outerDelay={0} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // Start with a touch interaction, then leave the trigger before the next hover.
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    // A later mouse-only hover should not be suppressed by the previous touch input.
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should not open the outer tooltip when moving from the outer popup to a nested trigger', async () => {
    render(() => <NestedTooltips innerDelay={OPEN_DELAY * 10} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Open the outer tooltip via hover.
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    const outerPopup = screen.getByTestId('outer-popup');
    expect(outerPopup).not.toBe(null);

    // Hover the outer popup (it's portaled outside the trigger).
    fireEvent.pointerEnter(outerPopup, { pointerType: 'mouse', clientX: 200, clientY: 200 });
    fireEvent.mouseOver(outerPopup);

    await flushMicrotasks();

    // Move back onto the nested trigger. The bubbling mouseover hits the
    // outer trigger and the close-on-nested-hover branch runs.
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should suppress the safePolygon-driven open while a nested trigger is hovered', async () => {
    render(() => <NestedTooltips innerDelay={OPEN_DELAY * 10} />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    // Repeated mouseMoves keep the hover path active; the open is gated by `shouldOpen()`.
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseMove(innerTrigger, { clientX: 51, clientY: 10 });

    tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should support nested triggers with a Provider delay={0}', async () => {
    render(() => (
      <Tooltip.Provider delay={0}>
        <NestedTooltips />
      </Tooltip.Provider>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
    expect(screen.getByTestId('inner-popup')).not.toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });
});

type TestTooltipProps = {
  rootProps?: Omit<Tooltip.Root.Props, 'children'>;
  triggerProps?: Omit<Tooltip.Trigger.Props, 'children'>;
  portalProps?: Omit<Tooltip.Portal.Props, 'children'>;
  positionerProps?: Omit<Tooltip.Positioner.Props, 'children'>;
  popupProps?: Omit<Tooltip.Popup.Props, 'children'>;
};

function TooltipParts(props: TestTooltipProps) {
  return (
    <Tooltip.Portal {...props.portalProps}>
      <Tooltip.Positioner data-testid="positioner" {...props.positionerProps}>
        <Tooltip.Popup data-testid="popup" {...props.popupProps}>
          Content
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  );
}

function ContainedTriggerTooltip(props: TestTooltipProps) {
  return (
    <Tooltip.Root {...props.rootProps}>
      <Tooltip.Trigger data-testid="trigger" {...props.triggerProps}>
        Toggle
      </Tooltip.Trigger>
      <TooltipParts {...omit(props, 'rootProps', 'triggerProps')} />
    </Tooltip.Root>
  );
}

function DetachedTriggerTooltip(props: TestTooltipProps) {
  const tooltipHandle = Tooltip.createHandle();
  return (
    <>
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...props.triggerProps}>
        Toggle
      </Tooltip.Trigger>
      <Tooltip.Root handle={tooltipHandle} {...props.rootProps}>
        <TooltipParts {...omit(props, 'rootProps', 'triggerProps')} />
      </Tooltip.Root>
    </>
  );
}

function MultipleDetachedTriggersTooltip(props: TestTooltipProps) {
  const tooltipHandle = Tooltip.createHandle();
  return (
    <>
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...props.triggerProps}>
        Toggle
      </Tooltip.Trigger>
      <Tooltip.Trigger data-testid="trigger-2" handle={tooltipHandle}>
        Toggle another
      </Tooltip.Trigger>
      <Tooltip.Root handle={tooltipHandle} {...props.rootProps}>
        <TooltipParts {...omit(props, 'rootProps', 'triggerProps')} />
      </Tooltip.Root>
    </>
  );
}
