import { Show, createSignal, flush, omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Popover } from '..';
import { OPEN_DELAY } from '../utils/constants';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { REASONS } from '../../internals/reasons';
import { act, createRef, flushMicrotasks, renderWithUser, wait } from '../../dialog/test-utils';
import { Dialog } from '../../dialog';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';

// ---------------------------------------------------------------------------------------------
// Fixtures (upstream `ContainedTriggerPopover`, `DetachedTriggerPopover`,
// `MultipleDetachedTriggersPopover`). Props objects may hold getters (`open`, `children`), so
// pass `children` as a getter to create them inside the Root.
// ---------------------------------------------------------------------------------------------

type TestPopoverProps = {
  rootProps?: Partial<Popover.Root.Props>;
  triggerProps?: Partial<Popover.Trigger.Props>;
  portalProps?: Partial<Popover.Portal.Props>;
  positionerProps?: Partial<Popover.Positioner.Props>;
  popupProps?: Partial<Popover.Popup.Props>;
  triggerPlacement?: 'before-content' | 'after-content';
  afterTrigger?: () => JSX.Element;
  includeTrigger?: boolean;
};

function renderTrigger(props: TestPopoverProps, extra?: Record<string, unknown>) {
  const triggerProps = () => props.triggerProps ?? {};
  return (
    <Popover.Trigger data-testid="trigger" {...omit(triggerProps(), 'children')} {...extra}>
      {triggerProps().children ?? 'Toggle'}
    </Popover.Trigger>
  );
}

function ContainedTriggerPopover(props: TestPopoverProps) {
  const portalProps = () => props.portalProps ?? {};
  const popupProps = () => props.popupProps ?? {};

  const renderPortal = () => (
    <Popover.Portal {...omit(portalProps(), 'children')}>
      {portalProps().children}
      <Popover.Positioner data-testid="positioner" {...props.positionerProps}>
        <Popover.Popup data-testid="popover-popup" {...omit(popupProps(), 'children')}>
          {'children' in popupProps() ? popupProps().children : 'Content'}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );

  const renderTriggerPart = () => (
    <>
      <Show when={props.includeTrigger !== false}>{renderTrigger(props)}</Show>
      {props.afterTrigger?.()}
    </>
  );

  return (
    <Popover.Root {...props.rootProps}>
      {props.triggerPlacement === 'after-content' ? (
        <>
          {renderPortal()}
          {renderTriggerPart()}
        </>
      ) : (
        <>
          {renderTriggerPart()}
          {renderPortal()}
        </>
      )}
    </Popover.Root>
  );
}

function DetachedTriggerPopover(props: TestPopoverProps) {
  const handle = Popover.createHandle();
  const triggers = () => (
    <>
      {renderTrigger(props, { handle })}
      {props.afterTrigger?.()}
    </>
  );
  return (
    <>
      <Show when={props.triggerPlacement !== 'after-content'}>{triggers()}</Show>
      <ContainedTriggerPopover
        rootProps={{ ...props.rootProps, handle }}
        portalProps={props.portalProps}
        positionerProps={props.positionerProps}
        popupProps={props.popupProps}
        includeTrigger={false}
      />
      <Show when={props.triggerPlacement === 'after-content'}>{triggers()}</Show>
    </>
  );
}

function MultipleDetachedTriggersPopover(props: TestPopoverProps) {
  const handle = Popover.createHandle();
  const triggers = () => (
    <>
      {renderTrigger(props, { handle })}
      {props.afterTrigger?.()}
      <Popover.Trigger data-testid="trigger-2" handle={handle}>
        Toggle another
      </Popover.Trigger>
    </>
  );
  return (
    <>
      <Show when={props.triggerPlacement !== 'after-content'}>{triggers()}</Show>
      <ContainedTriggerPopover
        rootProps={{ ...props.rootProps, handle }}
        portalProps={props.portalProps}
        positionerProps={props.positionerProps}
        popupProps={props.popupProps}
        includeTrigger={false}
      />
      <Show when={props.triggerPlacement === 'after-content'}>{triggers()}</Show>
    </>
  );
}

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

describe('<Popover.Root />', () => {
  describe('closing before the popup attaches', () => {
    // Requires CSS animations (jsdom has none).
    it.skip('waits for the closing animation once the popup attaches', () => {});

    it('unmounts the popup when an effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(true);
        onSettled(() => {
          setOpen(false);
        });
        return (
          <Popover.Root
            open={open()}
            onOpenChange={(next) => setOpen(next)}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        );
      }

      render(() => <App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });

    it('unmounts the popup when an effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();
      const [open, setOpen] = createSignal(false);

      const { user } = renderWithUser(() => (
        <Popover.Root
          open={open()}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              // Closes it again once the open has rendered (after the flush the press caused).
              queueMicrotask(() => setOpen(false));
            }
          }}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });
  });

  describe('hover intent across opens', () => {
    useFakeTimers();

    function App() {
      return (
        <Popover.Root modal={false}>
          <Popover.Trigger openOnHover delay={0} closeDelay={0}>
            Toggle
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner data-testid="positioner">
              <Popover.Popup>
                <button type="button" aria-haspopup="menu">
                  More
                </button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    }

    function hoverOpen(trigger: HTMLElement) {
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
    }

    function leave(trigger: HTMLElement) {
      fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
      fireEvent.mouseLeave(trigger, { relatedTarget: document.body });
      fireEvent.mouseMove(document.body);
    }

    it('closes a later hover open on leave after a press inside an earlier one', async () => {
      render(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      hoverOpen(trigger);
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).not.toBe(null);

      fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), { pointerType: 'mouse' });
      leave(trigger);
      tick(100);
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).not.toBe(null);

      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      tick(100);
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).toBe(null);

      hoverOpen(trigger);
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).not.toBe(null);

      leave(trigger);
      tick(100);
      await flushMicrotasks();

      expect(screen.queryByRole('dialog')).toBe(null);
    });
  });

  describe.each([
    { name: 'contained triggers', TestPopover: ContainedTriggerPopover },
    { name: 'detached triggers', TestPopover: DetachedTriggerPopover },
    { name: 'multiple detached triggers', TestPopover: MultipleDetachedTriggersPopover },
  ])('when using $name', ({ TestPopover }) => {
    it('should render the children', () => {
      render(() => <TestPopover />);

      expect(screen.getByText('Toggle')).not.toBe(null);
    });

    describe('uncontrolled open', () => {
      it('should close when the anchor is clicked twice', async () => {
        render(() => <TestPopover />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.click(anchor);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(anchor);
        flush();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('rewires dismiss interactions after closing and reopening', async () => {
        const { user } = renderWithUser(() => (
          <TestPopover
            rootProps={{ modal: false }}
            popupProps={{
              get children() {
                return <Popover.Close>Close</Popover.Close>;
              },
            }}
          />
        ));

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        fireEvent.click(document.body);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });
    });

    describe('controlled open', () => {
      it('should call onChange when the open state changes', async () => {
        const handleChange = vi.fn();
        const [open, setOpen] = createSignal(false);

        render(() => (
          <TestPopover
            rootProps={{
              get open() {
                return open();
              },
              onOpenChange: (nextOpen) => {
                handleChange(open());
                setOpen(nextOpen);
              },
            }}
          />
        ));

        expect(screen.queryByText('Content')).toBe(null);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.click(anchor);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(anchor);
        flush();

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('unmounts on a normal close after preventUnmountOnClose and external reopen', async () => {
        const [open, setOpen] = createSignal(false);
        let preventNextUnmount = true;

        const { user } = renderWithUser(() => (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open externally
            </button>
            <TestPopover
              rootProps={{
                get open() {
                  return open();
                },
                onOpenChange(nextOpen, details) {
                  if (!nextOpen && preventNextUnmount) {
                    preventNextUnmount = false;
                    details.preventUnmountOnClose();
                  }
                  setOpen(nextOpen);
                },
              }}
            />
          </>
        ));
        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Open externally' }));
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        const [open, setOpen] = createSignal(false);

        const { user } = renderWithUser(() => (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Show
            </button>
            <TestPopover
              rootProps={{
                get open() {
                  return open();
                },
                onOpenChange: (next) => setOpen(next),
              }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />
          </>
        ));

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        flush();

        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', () => {
        const [open, setOpen] = createSignal(false);

        render(() => (
          <TestPopover
            rootProps={{
              get open() {
                return open();
              },
              onOpenChange: (next) => setOpen(next),
            }}
            triggerProps={{ openOnHover: true, delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);
        flush();

        expect(screen.queryByRole('dialog')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        flush();

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it('cleans up the safe polygon handler after a hover-opened popup becomes click-sticky', async () => {
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        try {
          render(() => (
            <TestPopover
              rootProps={{ modal: false }}
              triggerProps={{ openOnHover: true, delay: 0, closeDelay: 0 }}
            />
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);
          flush();

          expect(screen.queryByRole('dialog')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');

          fireEvent.mouseLeave(trigger, { relatedTarget: positioner });
          fireEvent.mouseEnter(positioner);
          flush();

          let documentMouseMoveHandler: EventListenerOrEventListenerObject | undefined;
          for (let i = addEventListenerSpy.mock.calls.length - 1; i >= 0; i -= 1) {
            const [eventName, listener] = addEventListenerSpy.mock.calls[i];
            if (eventName === 'mousemove') {
              documentMouseMoveHandler = listener;
              break;
            }
          }

          expect(documentMouseMoveHandler).toEqual(expect.any(Function));

          fireEvent.click(trigger);
          await flushMicrotasks();

          fireEvent.mouseLeave(positioner);
          flush();

          expect(screen.queryByRole('dialog')).not.toBe(null);
          expect(removeEventListenerSpy).toHaveBeenCalledWith(
            'mousemove',
            documentMouseMoveHandler,
          );
        } finally {
          addEventListenerSpy.mockRestore();
          removeEventListenerSpy.mockRestore();
        }
      });
    });

    // Depends on the Menu port (developed concurrently in this repository).
    describe.skip('nested menu interactions', () => {
      it('keeps the popover open when a nested menu opens via Enter using a shared container', () => {});
      it('keeps the popover open when a nested menu opens via pointer using a shared container', () => {});
    });

    describe('prop: defaultOpen', () => {
      it('remains uncontrolled, so a trigger click closes it', async () => {
        const { user } = renderWithUser(() => <TestPopover rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        await user.click(screen.getByTestId('trigger'));

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      it('does not close after hovering out of a popup opened without trigger hover', () => {
        render(() => (
          <TestPopover rootProps={{ defaultOpen: true }} triggerProps={{ openOnHover: true }} />
        ));

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        flush();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: delay', () => {
      useFakeTimers();

      it('should open after delay with rest type by default', async () => {
        render(() => <TestPopover triggerProps={{ openOnHover: true, delay: 100 }} />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

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
        render(() => <TestPopover triggerProps={{ openOnHover: true, closeDelay: 100 }} />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

        tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(anchor);

        tick(50);

        expect(screen.getByText('Content')).not.toBe(null);

        tick(50);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('hover close transitions', () => {
      // Requires CSS animations (jsdom has none).
      it.skip('reopens immediately when re-hovering the trigger during a hover close transition', () => {});
    });

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents closing from a close press without changing the trigger', async () => {
        let closePressTriggerId: string | undefined;

        render(() => (
          <TestPopover
            triggerProps={{ id: 'trigger-1' }}
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen && eventDetails.reason === REASONS.closePress) {
                  closePressTriggerId = eventDetails.trigger?.id;
                  eventDetails.cancel();
                }
              },
            }}
            popupProps={{
              get children() {
                return (
                  <Popover.Close data-testid="close" id="close-button">
                    Close
                  </Popover.Close>
                );
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        fireEvent.click(trigger);
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('close'));
        flush();

        expect(closePressTriggerId).toBe('trigger-1');
        expect(screen.queryByTestId('close')).not.toBe(null);
      });

      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = renderWithUser(() => (
          <TestPopover
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
          expect(trigger).toHaveAttribute('data-popup-open');
        });
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
      });
    });

    describe('focus management', () => {
      it('focuses the trigger after the popover is closed but not unmounted', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <input type="text" />
            <TestPopover
              portalProps={{ keepMounted: true }}
              popupProps={{
                get children() {
                  return <Popover.Close>Close</Popover.Close>;
                },
              }}
            />
            <input type="text" />
          </div>
        ));

        const toggle = screen.getByRole('button', { name: 'Toggle' });

        await user.click(toggle);
        await flushMicrotasks();

        const close = screen.getByRole('button', { name: 'Close' });

        await user.click(close);

        await waitFor(
          () => {
            expect(toggle).toHaveFocus();
          },
          { timeout: 1500 },
        );
      });

      it('restores temporarily disabled focus before focusing a reopened keepMounted popover', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <input />
            <TestPopover
              portalProps={{ keepMounted: true }}
              popupProps={{
                get children() {
                  return <button data-testid="inside">Inside</button>;
                },
              }}
              afterTrigger={() => <input data-testid="after" />}
            />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        const inside = await screen.findByTestId('inside');
        await waitFor(() => {
          expect(inside).toHaveFocus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        await waitFor(() => {
          expect(screen.getByTestId('popover-popup')).not.toHaveAttribute('data-open');
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(inside).toHaveFocus();
        });
      });

      it('does not move focus to the popover when opened with hover', async () => {
        const { user } = renderWithUser(() => (
          <TestPopover
            triggerProps={{ openOnHover: true, delay: 0 }}
            popupProps={{
              get children() {
                return <Popover.Close>Close</Popover.Close>;
              },
            }}
          />
        ));

        const toggle = screen.getByRole('button', { name: 'Toggle' });

        toggle.focus();

        await user.hover(toggle);
        await flushMicrotasks();

        const close = screen.getByRole('button', { name: 'Close' });

        expect(close).not.toBe(null);
        expect(close).not.toHaveFocus();
      });

      it('does not change focus when opened with hover and closed', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <input type="text" data-testid="first-input" />
            <TestPopover
              triggerProps={{ openOnHover: true, delay: 0, closeDelay: 0 }}
              popupProps={{ class: 'popup', children: null }}
            />
            <input type="text" data-testid="last-input" />
          </div>
        ));

        const toggle = screen.getByRole('button', { name: 'Toggle' });
        const firstInput = screen.getByTestId('first-input');
        const lastInput = screen.getByTestId('last-input');

        lastInput.focus();

        await user.hover(toggle);
        await flushMicrotasks();

        await user.hover(firstInput);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });

        expect(lastInput).toHaveFocus();
      });

      describe('with the popup following immediately the only trigger', () => {
        it('moves focus to the element following the trigger, excluding the popup, when tabbing forward from the open popup', async () => {
          const { user } = renderWithUser(() => (
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                popupProps={{
                  get children() {
                    return <input data-testid="input-inside" />;
                  },
                }}
                afterTrigger={() => <input data-testid="focus-target" />}
              />
              <input />
            </div>
          ));

          const inputInside = screen.getByTestId('input-inside');
          await act(() => inputInside.focus());

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        // Depends on the Combobox port (developed concurrently in this repository).
        it.skip('closes a nested combobox popup when tabbing out of the popover', () => {});
        it.skip('closes a nested combobox popup when tabbing backward to the trigger', () => {});

        // Requires real browser focus navigation (upstream skips it in jsdom).
        it.skip('moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward', () => {});
      });

      describe('with focusable elements between the trigger and the popup', () => {
        it('closes and moves focus before the trigger when tabbing backward from the focused trigger', async () => {
          const { user } = renderWithUser(() => (
            <div>
              <input data-testid="before" />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                popupProps={{
                  get children() {
                    return <input data-testid="input-inside" />;
                  },
                }}
              />
              <input />
            </div>
          ));

          // Let the initial focus move into the popup first (it's applied a frame after the
          // popup mounts), so it can't land after the trigger is focused.
          await waitFor(() => {
            expect(screen.getByTestId('input-inside')).toHaveFocus();
          });
          const trigger = screen.getByTestId('trigger');
          await act(() => trigger.focus());

          await user.tab({ shift: true });

          await waitFor(() => {
            expect(screen.getByTestId('before')).toHaveFocus();
          });

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        it('moves focus to the element following the trigger when tabbing forward from the open popup', async () => {
          const { user } = renderWithUser(() => (
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                afterTrigger={() => <input data-testid="focus-target" />}
                popupProps={{
                  get children() {
                    return <input data-testid="input-inside" />;
                  },
                }}
              />
              <input />
            </div>
          ));

          const inputInside = screen.getByTestId('input-inside');
          await act(() => inputInside.focus());

          await user.tab();

          await waitFor(() => {
            expect(screen.getByTestId('focus-target')).toHaveFocus();
          });

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        // Require real browser focus navigation (upstream skips them in jsdom).
        it.skip('moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward', () => {});
        it.skip('moves focus to the element preceding the trigger when tabbing backward from the trigger while open', () => {});
      });

      describe('with the popup preceding immediately the only trigger', () => {
        it('moves focus to the element following the trigger, excluding the popup, when tabbing forward from the open popup', async () => {
          const { user } = renderWithUser(() => (
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                triggerPlacement="after-content"
                popupProps={{
                  get children() {
                    return <input data-testid="input-inside" />;
                  },
                }}
                afterTrigger={() => <input data-testid="focus-target" />}
              />
              <input />
            </div>
          ));

          const inputInside = screen.getByTestId('input-inside');
          await act(() => inputInside.focus());

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        // Requires real browser focus navigation (upstream skips it in jsdom).
        it.skip('moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward', () => {});
      });
    });

    describe('outside press event with backdrops', () => {
      it('uses intentional outside press with user backdrop (mouse): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        render(() => (
          <TestPopover
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
            portalProps={{
              get children() {
                return <Popover.Backdrop data-testid="backdrop" />;
              },
            }}
          />
        ));

        const backdrop = screen.getByTestId('backdrop');

        fireEvent.mouseDown(backdrop);
        flush();
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('uses intentional outside press with internal backdrop (modal=true): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        render(() => (
          <TestPopover
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />
        ));

        const internalBackdrop = document.querySelector('[data-base-ui-inert][role="presentation"]') as HTMLElement;

        fireEvent.mouseDown(internalBackdrop);
        flush();
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(internalBackdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via outside press: works when clicking another element inside the same shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          render(
            () => (
              <>
                <button data-testid="outside">Outside</button>
                <TestPopover
                  rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
                  portalProps={{ container: shadowRoot }}
                />
              </>
            ),
            { container },
          );
          flush();

          const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;
          const activeTrigger = shadowRoot.querySelector('[aria-expanded="true"]');
          expect(activeTrigger).not.toBe(null);

          fireEvent.click(outsideButton);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
          expect(handleOpenChange.mock.calls[0][1].trigger).toBe(activeTrigger);
        } finally {
          host.remove();
        }
      });

      it('closing via outside press: works when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          render(
            () => (
              <TestPopover
                rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
                portalProps={{ container: shadowRoot }}
              />
            ),
            { container },
          );
          flush();
          const activeTrigger = shadowRoot.querySelector('[aria-expanded="true"]');
          expect(activeTrigger).not.toBe(null);

          fireEvent.click(document.body);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
          expect(handleOpenChange.mock.calls[0][1].trigger).toBe(activeTrigger);
        } finally {
          host.remove();
        }
      });
    });

    describe('non-modal focus transitions', () => {
      it('closes as soon as focus leaves the popup on pointer down outside', async () => {
        render(() => (
          <>
            <TestPopover
              rootProps={{ defaultOpen: true }}
              popupProps={{
                get children() {
                  return <button data-testid="inside">Inside</button>;
                },
              }}
            />
            <button data-testid="outside">Outside</button>
          </>
        ));

        const inside = screen.getByTestId('inside');
        await act(() => inside.focus());

        const outside = screen.getByTestId('outside');

        fireEvent.pointerDown(outside);
        await act(() => outside.focus());
        fireEvent.focusOut(inside, { relatedTarget: outside });

        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      // Upstream runs these only in a real browser: they need the Menu port, CSS transitions
      // and real tab navigation through focus guards.
      it.skip('moves focus to the next element when tabbing out of a nested menu inside the popover', () => {});
      describe.skip('during the exit animation', () => {
        it('moves focus to the element following the trigger when tabbing forward from the trigger', () => {});
      });
      describe.skip('with no other tabbable element on the page', () => {
        it('does not loop focus between guards when tabbing out of the popup', () => {});
        it('does not loop focus between guards when shift-tabbing out of the trigger', () => {});
      });
    });

    // Upstream runs this only in a real browser (focus fallback on element removal).
    describe.skip('pointerdown removal', () => {
      it('moves focus to the popup when a focused child is removed on pointerdown and outside press still dismisses', () => {});
    });

    describe('prop: actionsRef', () => {
      it('unmounts the popover when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          } as Popover.Root.Actions,
        };

        const { user } = renderWithUser(() => (
          <TestPopover
            rootProps={{
              actionsRef,
              onOpenChange: (_open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await act(() => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('does not repeat closing completion when `unmount` is called after the automatic unmount', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();

        const { user } = renderWithUser(() => (
          <TestPopover rootProps={{ actionsRef, onOpenChangeComplete }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

        await act(() => actionsRef.current!.unmount());
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      // React's `startTransition` defers the controlled close; Solid applies it on the next flush,
      // which is the case covered here.
      it('keeps the opt-out when a controlled close is applied later', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        const [open, setOpen] = createSignal(true);

        const { user } = renderWithUser(() => (
          <TestPopover
            rootProps={{
              get open() {
                return open();
              },
              actionsRef,
              onOpenChangeComplete,
              onOpenChange: (nextOpen, details) => {
                if (!nextOpen) {
                  details.preventUnmountOnClose();
                }
                queueMicrotask(() => setOpen(nextOpen));
              },
            }}
          />
        ));
        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

        await act(() => actionsRef.current!.unmount());
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([isOpen]) => !isOpen)).toHaveLength(1);
      });

      it('ignores `unmount` while the popup is open', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        render(() => (
          <TestPopover rootProps={{ defaultOpen: true, actionsRef, onOpenChangeComplete }} />
        ));
        const popup = screen.getByRole('dialog');

        await act(() => actionsRef.current!.unmount());

        expect(screen.getByRole('dialog')).toBe(popup);
        expect(popup).not.toHaveAttribute('data-starting-style');
        expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      });

      it('unmounts when `close` and `unmount` are called in one batch', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        render(() => (
          <TestPopover
            rootProps={{
              defaultOpen: true,
              actionsRef,
              onOpenChangeComplete,
              onOpenChange: (open, details) => {
                if (!open) {
                  details.preventUnmountOnClose();
                }
              },
            }}
          />
        ));

        await act(() => {
          actionsRef.current!.close();
          actionsRef.current!.unmount();
        });

        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('unmounts when `close` and `unmount` are called in one batch while controlled', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        const [open, setOpen] = createSignal(true);

        render(() => (
          <TestPopover
            rootProps={{
              get open() {
                return open();
              },
              actionsRef,
              onOpenChangeComplete,
              onOpenChange: (nextOpen, details) => {
                if (!nextOpen) {
                  details.preventUnmountOnClose();
                }
                setOpen(nextOpen);
              },
            }}
          />
        ));

        await act(() => {
          actionsRef.current!.close();
          actionsRef.current!.unmount();
        });

        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([isOpen]) => !isOpen)).toHaveLength(1);
      });

      it('still unmounts on a later close after `unmount` was called while open', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        const { user } = renderWithUser(() => (
          <TestPopover rootProps={{ defaultOpen: true, actionsRef, onOpenChangeComplete }} />
        ));

        await act(() => actionsRef.current!.unmount());
        expect(screen.queryByRole('dialog')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });

      it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        let reopenOnComplete = true;
        let optOut = true;
        const [open, setOpen] = createSignal(true);

        const { user } = renderWithUser(() => (
          <TestPopover
            rootProps={{
              get open() {
                return open();
              },
              actionsRef,
              onOpenChange: (nextOpen, details) => {
                if (!nextOpen && optOut) {
                  details.preventUnmountOnClose();
                }
                setOpen(nextOpen);
              },
              onOpenChangeComplete: (nextOpen) => {
                onOpenChangeComplete(nextOpen);
                // An exit-animation callback that reopens right after it unmounts.
                if (!nextOpen && reopenOnComplete) {
                  reopenOnComplete = false;
                  setOpen(true);
                }
              },
            }}
          />
        ));
        await act(() => actionsRef.current!.close());
        expect(screen.queryByRole('dialog')).not.toBe(null);

        await act(() => actionsRef.current!.unmount());
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([isOpen]) => !isOpen)).toHaveLength(1);

        optOut = false;
        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(onOpenChangeComplete.mock.calls.filter(([isOpen]) => !isOpen)).toHaveLength(2);
      });

      it('completes closing once when `unmount` is called twice in one batch', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        const onOpenChangeComplete = vi.fn();
        const { user } = renderWithUser(() => (
          <TestPopover
            rootProps={{
              defaultOpen: true,
              actionsRef,
              onOpenChangeComplete,
              onOpenChange: (open, details) => {
                if (!open) {
                  details.preventUnmountOnClose();
                }
              },
            }}
          />
        ));

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        expect(screen.queryByRole('dialog')).not.toBe(null);

        await act(() => {
          actionsRef.current!.unmount();
          actionsRef.current!.unmount();
        });
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('closes the popover when the `close` method is called', async () => {
        const actionsRef = createRef<Popover.Root.Actions>();
        render(() => <TestPopover rootProps={{ defaultOpen: true, actionsRef }} />);

        await act(() => {
          actionsRef.current!.close();
        });

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      it('clears the active trigger when `unmount` is called right after a controlled close', async () => {
        const [open, setOpen] = createSignal(false);
        const actionsRef = createRef<Popover.Root.Actions>();

        function App() {
          return (
            <Popover.Root open={open()} onOpenChange={(next) => setOpen(next)} actionsRef={actionsRef}>
              <Popover.Trigger>Trigger 1</Popover.Trigger>
              <Popover.Trigger>Trigger 2</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popup">Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          );
        }

        const { user } = renderWithUser(() => <App />);
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        // The close lands with the prop on the next flush; `unmount` follows it in the same batch.
        await act(() => {
          setOpen(false);
          actionsRef.current?.unmount();
        });
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        await act(() => setOpen(true));
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      it('clears the active trigger when a popup part calls `unmount` as a controlled close renders', async () => {
        const [open, setOpen] = createSignal(false);
        const actionsRef = createRef<Popover.Root.Actions>();

        const { user } = renderWithUser(() => (
          <Popover.Root open={open()} onOpenChange={(next) => setOpen(next)} actionsRef={actionsRef}>
            <Popover.Trigger>Trigger 1</Popover.Trigger>
            <Popover.Trigger>Trigger 2</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup" />
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        ));
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        // A pending exit animation leaves the part's `unmount` call as the only one.
        Object.defineProperty(screen.getByTestId('popup'), 'getAnimations', {
          value: () => [{ finished: new Promise(() => {}) }],
          configurable: true,
        });

        await act(() => setOpen(false));
        // The part calls `unmount` once the controlled close has rendered.
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
        await act(() => actionsRef.current?.unmount());
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        await act(() => setOpen(true));
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestPopover rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should only render focus guards inside the popup when `true`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestPopover
              rootProps={{ modal: true }}
              popupProps={{
                get children() {
                  return <Popover.Close>Close</Popover.Close>;
                },
              }}
            />
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });
        await flushMicrotasks();

        expect(
          trigger.previousElementSibling?.hasAttribute('data-base-ui-focus-guard') ?? false,
        ).toBe(false);
        expect(trigger.nextElementSibling?.hasAttribute('data-base-ui-focus-guard') ?? false).toBe(
          false,
        );
        expect(
          document.querySelectorAll('[data-base-ui-focus-guard][data-type="inside"]'),
        ).toHaveLength(2);
      });

      it('should keep trigger focus guards when `true` without a close part', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestPopover
              rootProps={{ defaultOpen: true, modal: true }}
              popupProps={{
                get children() {
                  return <input data-testid="input-inside" />;
                },
              }}
              afterTrigger={() => <input data-testid="focus-target" />}
            />
          </div>
        ));
        await flushMicrotasks();

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        expect(trigger.previousElementSibling).toHaveAttribute('data-base-ui-focus-guard');
        expect(trigger.nextElementSibling).toHaveAttribute('data-base-ui-focus-guard');

        await act(() => screen.getByTestId('input-inside').focus());

        await user.tab();

        expect(screen.getByTestId('focus-target')).toHaveFocus();

        await waitFor(() => {
          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = renderWithUser(() => (
          <div>
            <TestPopover rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });

      describe('with openOnHover', () => {
        useFakeTimers();

        it('enables modal behavior after a hover-open is clicked', async () => {
          render(() => (
            <TestPopover
              rootProps={{ modal: true }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('dialog')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).toBe(null);

          tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();

          expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
        });

        it('reopens on hover after an impatient click is followed by a close button press', async () => {
          render(() => (
            <TestPopover
              triggerProps={{ openOnHover: true, delay: 100 }}
              popupProps={{
                get children() {
                  return <Popover.Close>Close</Popover.Close>;
                },
              }}
            />
          ));

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).not.toBe(null);

          tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);
          await flushMicrotasks();

          fireEvent.click(screen.getByRole('button', { name: 'Close' }));
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).not.toBe(null);
        });
      });
    });

    // Requires layout (the popup width is compared with the viewport width).
    describe.skip('scroll locking', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', () => {});
    });

    describe('nested popup interactions', () => {
      it('returns focus through nested programmatic popovers in close order', async () => {
        function Test() {
          const [childOpen, setChildOpen] = createSignal(false);

          return (
            <Popover.Root>
              <Popover.Trigger>Parent trigger</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="parent-popup">
                    <button type="button" onClick={() => setChildOpen(true)}>
                      Open child programmatically
                    </button>

                    <Popover.Root
                      open={childOpen()}
                      triggerId="child-reference"
                      onOpenChange={(next) => setChildOpen(next)}
                    >
                      <Popover.Trigger id="child-reference">Child reference</Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Positioner>
                          <Popover.Popup data-testid="child-popup">
                            <Popover.Close>Close child</Popover.Close>
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>

                    <Popover.Close>Close parent</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          );
        }

        const { user } = renderWithUser(() => <Test />);

        const parentTrigger = screen.getByRole('button', { name: 'Parent trigger' });
        await user.click(parentTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        });

        const childOpener = screen.getByRole('button', {
          name: 'Open child programmatically',
        });
        await user.click(childOpener);

        await waitFor(() => {
          expect(screen.queryByTestId('child-popup')).not.toBe(null);
        });

        await user.click(screen.getByRole('button', { name: 'Close child' }));

        await waitFor(() => {
          expect(screen.queryByTestId('child-popup')).toBe(null);
        });
        await waitFor(() => {
          expect(childOpener).toHaveFocus();
        });
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Close parent' }));

        await waitFor(() => {
          expect(screen.queryByTestId('parent-popup')).toBe(null);
        });
        await waitFor(() => {
          expect(parentTrigger).toHaveFocus();
        });
      });

      it('keeps the parent popover open when press starts in nested popover and ends outside', async () => {
        render(() => (
          <div>
            <button type="button" data-testid="outside">
              Outside
            </button>

            <Popover.Root defaultOpen>
              <Popover.Trigger>Parent</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="parent-popup">
                    <Popover.Root>
                      <Popover.Trigger>Child</Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Positioner>
                          <Popover.Popup data-testid="child-popup">Child content</Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        ));

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);

        const childTrigger = screen.getByRole('button', { name: 'Child' });

        fireEvent.click(childTrigger);

        const childPopup = await screen.findByTestId('child-popup');
        const outside = screen.getByTestId('outside');

        fireEvent.pointerDown(childPopup, { pointerType: 'mouse', button: 0 });
        fireEvent.click(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        });
        expect(screen.queryByTestId('child-popup')).not.toBe(null);
      });

      // Requires real touch scrolling and the Combobox port (upstream skips it in jsdom).
      it.skip('should not close popover when scrolling nested popup on touch', () => {});

      it('should close child popover when clicking parent popover', async () => {
        const { user } = renderWithUser(() => (
          <TestPopover
            triggerProps={{ 'data-testid': 'parent-trigger' } as Popover.Trigger.Props}
            popupProps={
              {
                'data-testid': 'parent-popup',
                get children() {
                  return (
                    <ContainedTriggerPopover
                      triggerProps={{ 'data-testid': 'child-trigger' } as Popover.Trigger.Props}
                      popupProps={{ 'data-testid': 'child-popup', children: null } as Popover.Popup.Props}
                    />
                  );
                },
              } as Popover.Popup.Props
            }
          />
        ));

        expect(screen.queryByTestId('parent-popup')).toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        const parentTrigger = screen.getByTestId('parent-trigger');
        await user.click(parentTrigger);
        await flushMicrotasks();

        const parentPopup = screen.getByTestId('parent-popup');

        expect(parentPopup).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        const childTrigger = screen.getByTestId('child-trigger');
        await user.click(childTrigger);
        await flushMicrotasks();

        expect(parentPopup).not.toBe(null);
        expect(screen.getByTestId('child-popup')).not.toBe(null);

        await user.click(parentPopup);
        await flushMicrotasks();

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);
      });
    });

  });

  it('keeps the popover open when Escape closes a nested dialog after a backdrop press', async () => {
    const onPopoverOpenChange = vi.fn();
    const { user } = renderWithUser(() => (
      <Popover.Root defaultOpen onOpenChange={onPopoverOpenChange}>
        <Popover.Trigger>Popover trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popover">
              <Dialog.Root disablePointerDismissal>
                <Dialog.Trigger>Open dialog</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Backdrop data-testid="backdrop" />
                  <Dialog.Popup data-testid="dialog">
                    <input data-testid="input" />
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => {
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    // `disablePointerDismissal` keeps the dialog open, but the press still moves focus to the body.
    await user.click(screen.getByTestId('backdrop'));
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByTestId('dialog')).not.toBe(null);

    await user.keyboard('[Escape]');

    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).toBe(null);
    });
    expect(screen.queryByTestId('popover')).not.toBe(null);
    expect(onPopoverOpenChange).not.toHaveBeenCalled();
  });

  describe('outside press in a dialog outside its component tree', () => {
    type User = ReturnType<typeof renderWithUser>['user'];

    it.each([
      {
        name: 'clicking a button',
        submits: false,
        press: async (user: User) => {
          await user.click(screen.getByRole('button', { name: 'Inside dialog' }));
        },
      },
      {
        // Implicit form submission dispatches a click on the submit button.
        name: 'pressing Enter in a form input',
        submits: true,
        press: async (user: User) => {
          await user.keyboard('[Enter]');
        },
      },
    ])('stays open when $name inside a modal dialog opened after it', async ({ press, submits }) => {
      const dialogHandle = Dialog.createHandle();
      const onPopoverOpenChange = vi.fn();
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

      const { user } = renderWithUser(() => (
        <>
          <Popover.Root defaultOpen onOpenChange={onPopoverOpenChange}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover">
                  <Dialog.Trigger handle={dialogHandle}>Open dialog</Dialog.Trigger>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Dialog.Root handle={dialogHandle}>
            <Dialog.Portal>
              <Dialog.Popup data-testid="dialog">
                <form onSubmit={onSubmit}>
                  <input data-testid="input" />
                  <button type="submit">Submit</button>
                </form>
                <button type="button">Inside dialog</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));

      await user.click(screen.getByRole('button', { name: 'Open dialog' }));
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBe(null);
      });
      expect(screen.queryByTestId('popover')).not.toBe(null);
      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveFocus();
      });

      await press(user);

      expect(onSubmit.mock.calls.length).toBe(submits ? 1 : 0);
      expect(screen.queryByTestId('dialog')).not.toBe(null);
      expect(screen.queryByTestId('popover')).not.toBe(null);
      expect(onPopoverOpenChange).not.toHaveBeenCalled();
    });

    it('closes when pressing inside a modal dialog opened before it', async () => {
      const popoverHandle = Popover.createHandle();
      const onPopoverOpenChange = vi.fn();

      const { user } = renderWithUser(() => (
        <>
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Dialog.Popup data-testid="dialog">
                <Popover.Trigger handle={popoverHandle}>Open popover</Popover.Trigger>
                {/* Keeps focus where it is, so only the outside press can close the popover. */}
                <button type="button" onMouseDown={(event) => event.preventDefault()}>
                  Inside dialog
                </button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Popover.Root handle={popoverHandle} onOpenChange={onPopoverOpenChange}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover" />
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      ));

      await user.click(screen.getByRole('button', { name: 'Open popover' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popover')).not.toBe(null);
      });
      onPopoverOpenChange.mockClear();

      await user.click(screen.getByRole('button', { name: 'Inside dialog' }));

      await waitFor(() => {
        expect(screen.queryByTestId('popover')).toBe(null);
      });
      expect(onPopoverOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      expect(screen.queryByTestId('dialog')).not.toBe(null);
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('does not leak from a canceled close into a synchronous second close', async () => {
      const popover = Popover.createHandle();
      let closeAttempts = 0;

      const { user } = renderWithUser(() => (
        <>
          <button type="button" onClick={() => popover.close()}>
            Close popover
          </button>
          <Popover.Root
            handle={popover}
            defaultOpen
            defaultTriggerId="trigger"
            onOpenChange={(open, details) => {
              if (open) {
                return;
              }

              closeAttempts += 1;

              if (closeAttempts === 1) {
                details.preventUnmountOnClose();
                details.cancel();
                popover.close();
              }
            }}
          >
            <Popover.Trigger handle={popover} id="trigger">
              Toggle
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      ));

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Close popover' }));

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });

    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const popover = Popover.createHandle();
      const [showRoot, setShowRoot] = createSignal(true);
      const [remountOpen, setRemountOpen] = createSignal(false);
      let preventNextUnmount = true;

      const { user } = renderWithUser(() => (
        <>
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
            <Popover.Root
              handle={popover}
              defaultOpen={remountOpen()}
              defaultTriggerId="trigger"
              onOpenChange={(open, details) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              }}
            >
              <Popover.Trigger handle={popover} id="trigger">
                Toggle
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popup">Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </Show>
        </>
      ));
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      flush();
      expect(screen.queryByTestId('popup')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });
  });

  describe('close requests', () => {
    it('reports the active trigger for an outside press close', async () => {
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <div>
          <button type="button">Outside</button>
          <Popover.Root onOpenChange={onOpenChange}>
            <Popover.Trigger>Trigger A</Popover.Trigger>
            <Popover.Trigger>Trigger B</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ));
      const triggerB = screen.getByRole('button', { name: 'Trigger B' });

      await user.click(triggerB);
      flush();
      expect(screen.queryByText('Content')).not.toBe(null);
      fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
      await waitFor(() => {
        expect(screen.queryByText('Content')).toBe(null);
      });

      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange.mock.calls[1][1].reason).toBe(REASONS.outsidePress);
      expect(onOpenChange.mock.calls[1][1].trigger).toBe(triggerB);
    });

    it('marks a close without a reason as a dismissal', async () => {
      const handle = Popover.createHandle();
      render(() => (
        <Popover.Root handle={handle} defaultOpen>
          <Popover.Trigger handle={handle}>Trigger</Popover.Trigger>
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');

      await act(() => {
        handle.store.setOpen(
          false,
          createChangeEventDetails(undefined as unknown as typeof REASONS.none),
        );
      });

      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
    });
  });

  describe('hover open after a dismissal', () => {
    it('renders the open popup without the dismissal instant type', async () => {
      const renders: { open: boolean; instant: string | undefined }[] = [];

      const { user } = renderWithUser(() => (
        <Popover.Root>
          <Popover.Trigger openOnHover delay={0}>
            Trigger
          </Popover.Trigger>
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup
                data-testid="popup"
                class={(state) => {
                  renders.push({ open: state.open, instant: state.instant });
                  return undefined;
                }}
              >
                Content
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
      });
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
      await user.unhover(trigger);
      renders.length = 0;

      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });

      expect(renders.find((entry) => entry.open)).toEqual({ open: true, instant: undefined });
    });

    it('cancels a pending hover open when the `close` action is called', async () => {
      const onOpenChange = vi.fn();
      const actionsRef = createRef<Popover.Root.Actions>();
      render(() => (
        <Popover.Root actionsRef={actionsRef} onOpenChange={onOpenChange}>
          <Popover.Trigger openOnHover delay={100}>
            Trigger
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      await act(() => {
        actionsRef.current!.close();
      });
      await act(() => wait(200));

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  describe('after a close from a trigger', () => {
    function App() {
      const [open, setOpen] = createSignal(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open externally
          </button>
          <Popover.Root open={open()} onOpenChange={(next) => setOpen(next)}>
            <Popover.Trigger>Trigger A</Popover.Trigger>
            <Popover.Trigger>Trigger B</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Popover.Root>
            <Popover.Trigger>Other popover</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="other-popup">Other content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      );
    }

    it('closes when that trigger is pressed after a controlled open without a trigger', async () => {
      const { user } = renderWithUser(() => <App />);
      const triggerA = screen.getByRole('button', { name: 'Trigger A' });

      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Open externally' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });

    it('returns focus to that trigger when a later open started from the body', async () => {
      const { user } = renderWithUser(() => <App />);
      const triggerA = screen.getByRole('button', { name: 'Trigger A' });
      const otherTrigger = screen.getByRole('button', { name: 'Other popover' });

      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });

      // Another popover is the last one opened from a focused element.
      await user.click(otherTrigger);
      await waitFor(() => {
        expect(screen.queryByTestId('other-popup')).not.toBe(null);
      });
      await user.click(otherTrigger);
      await waitFor(() => {
        expect(screen.queryByTestId('other-popup')).toBe(null);
      });

      await act(() => otherTrigger.blur());
      expect(document.activeElement).toBe(document.body);

      fireEvent.click(screen.getByRole('button', { name: 'Open externally' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      await waitFor(() => {
        expect(triggerA).toHaveFocus();
      });
    });
  });
});
