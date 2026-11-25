import { For, createSignal, flush, onSettled, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Select } from '..';
import { SelectSeparatorDataAttributes } from '../index';
import { Field } from '../../field';
import { Form } from '../../form';
import { Dialog } from '../../dialog';
import { REASONS } from '../../internals/reasons';
import {
  act,
  createRef,
  flushMicrotasks,
  renderWithProps,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../test-utils';

type Actions = Select.Root.Actions;

function DefaultPopup(props: { children?: JSX.Element }) {
  return (
    <Select.Portal>
      <Select.Positioner>
        <Select.Popup>{props.children}</Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

function AB() {
  return (
    <DefaultPopup>
      <Select.Item value="a">a</Select.Item>
      <Select.Item value="b">b</Select.Item>
    </DefaultPopup>
  );
}

describe('<Select.Root />', () => {
  describe('closing before the popup attaches', () => {
    it('finishes closing when an effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(true);
        onSettled(() => {
          setOpen(false);
        });
        return (
          <Select.Root
            open={open()}
            onOpenChange={setOpen}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <DefaultPopup>
              <Select.Item value="apple">Apple</Select.Item>
            </DefaultPopup>
          </Select.Root>
        );
      }

      render(() => <App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      // Upstream keeps the list mounted (hidden) because focus returns to the trigger, which
      // force-mounts the items; here the close lands before any focus moved, so the list may be
      // unmounted instead. Either way, it isn't left closing.
      const listbox = screen.queryByRole('listbox', { hidden: true });
      if (listbox) {
        expect(listbox).not.toHaveAttribute('data-ending-style');
      }
    });

    it('finishes closing when an effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Select.Root
            open={open()}
            onOpenChange={(next) => {
              setOpen(next);
              if (next) {
                queueMicrotask(() => setOpen(false));
              }
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <DefaultPopup>
              <Select.Item value="apple">Apple</Select.Item>
            </DefaultPopup>
          </Select.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      await flushMicrotasks();
      // The press mounts the list while closed so its items can register; it isn't left closing.
      expect(screen.getByRole('listbox', { hidden: true })).not.toHaveAttribute(
        'data-ending-style',
      );
    });
  });

  it('exposes the orientation attribute rendered by Separator', () => {
    render(() => <Select.Separator orientation="vertical" />);

    const separator = screen.getByRole('presentation');
    expect(separator).toHaveAttribute(SelectSeparatorDataAttributes.orientation, 'vertical');
  });

  describe('manual unmount lifecycle', () => {
    type PopupProps = Pick<
      Select.Root.Props<string>,
      'open' | 'defaultOpen' | 'onOpenChange' | 'onOpenChangeComplete' | 'actionsRef'
    >;

    function Popup(props: PopupProps) {
      // `defaultOpen` is an initial value: read once.
      const [open, setOpen] = createSignal(untrack(() => props.defaultOpen) ?? false);
      return (
        <Select.Root
          defaultOpen={props.defaultOpen}
          actionsRef={props.actionsRef}
          onOpenChangeComplete={props.onOpenChangeComplete}
          open={props.open ?? open()}
          onOpenChange={(nextOpen, details) => {
            props.onOpenChange?.(nextOpen, details);
            if (!details.isCanceled) {
              setOpen(nextOpen);
            }
          }}
        >
          <Select.Trigger />
          <DefaultPopup>
            <Select.Item value="apple">Apple</Select.Item>
          </DefaultPopup>
        </Select.Root>
      );
    }

    const closes = (fn: ReturnType<typeof vi.fn>) =>
      fn.mock.calls.filter(([open]) => !open).length;

    it('automatically unmounts with an actions ref and completes closing once', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user } = renderWithUser(() => (
        <Popup actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />
      ));

      expect(onOpenChangeComplete).not.toHaveBeenCalled();
      await user.click(screen.getByRole('combobox'));
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closes(onOpenChangeComplete)).toBe(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      await act(() => actionsRef.current!.unmount());
      expect(closes(onOpenChangeComplete)).toBe(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = renderWithProps((props: PopupProps) => <Popup {...props} />, {
        defaultOpen: true,
        actionsRef,
        onOpenChangeComplete,
        onOpenChange: (open, details) => {

          if (!open) {
            details.preventUnmountOnClose();
          }
        },
      } as PopupProps);

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      await act(() => actionsRef.current!.unmount());
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closes(onOpenChangeComplete)).toBe(1);

      await setProps({ open: true });
      await screen.findByRole('listbox');
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closes(onOpenChangeComplete)).toBe(2);
    });

    it('clears the opt-out when a controlled reopen interrupts a pending unmount', async () => {
      const onOpenChangeComplete = vi.fn();
      const { user, setProps } = renderWithProps((props: PopupProps) => <Popup {...props} />, {
        defaultOpen: true,
        onOpenChangeComplete,
        onOpenChange: (open, details) => {
          if (!open) {
            details.preventUnmountOnClose();
          }
        },
      } as PopupProps);

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      await setProps({ open: true });
      await setProps({ open: false });
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closes(onOpenChangeComplete)).toBe(1);
    });

    it('ignores an opt-out on a canceled close', async () => {
      let cancel = true;
      const { user } = renderWithUser(() => (
        <Popup
          defaultOpen
          onOpenChange={(open, details) => {
            if (!open && cancel) {
              details.preventUnmountOnClose();
              details.cancel();
            }
          }}
        />
      ));

      await user.click(screen.getByRole('option'));
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      cancel = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('keeps the opt-out when a controlled close is applied later', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      function App() {
        const [open, setOpen] = createSignal(true);
        return (
          <Popup
            open={open()}
            actionsRef={actionsRef}
            onOpenChangeComplete={onOpenChangeComplete}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen) {
                details.preventUnmountOnClose();
              }
              // Upstream applies the change in a React transition.
              queueMicrotask(() => setOpen(nextOpen));
            }}
          />
        );
      }

      const { user } = renderWithUser(() => <App />);
      await user.click(screen.getByRole('option'));
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'),
      );
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      await act(() => actionsRef.current!.unmount());
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closes(onOpenChangeComplete)).toBe(1);
    });

    it('closes through the `close` action so `onOpenChange` can opt out', async () => {
      const actionsRef = createRef<Actions>();
      const reasons: string[] = [];
      render(() => (
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));

      await act(() => actionsRef.current!.close());
      expect(reasons).toEqual([REASONS.imperativeAction]);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await act(() => actionsRef.current!.unmount());
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores `unmount` while the popup is open', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />
      ));
      const popup = screen.getByRole('listbox');

      await act(() => actionsRef.current!.unmount());

      expect(screen.getByRole('listbox')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    });

    it('unmounts when `close` and `unmount` are called in one batch', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));

      await act(() => {
        actionsRef.current!.close();
        actionsRef.current!.unmount();
      });

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closes(onOpenChangeComplete)).toBe(1);
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user } = renderWithUser(() => (
        <Popup defaultOpen actionsRef={actionsRef} onOpenChangeComplete={onOpenChangeComplete} />
      ));

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      await act(() => actionsRef.current!.unmount());
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      let reopenOnComplete = true;
      let optOut = true;
      function App() {
        const [open, setOpen] = createSignal(true);
        return (
          <Popup
            open={open()}
            actionsRef={actionsRef}
            onOpenChange={(nextOpen, details) => {
              if (!nextOpen && optOut) {
                details.preventUnmountOnClose();
              }
              setOpen(nextOpen);
            }}
            onOpenChangeComplete={(nextOpen) => {
              onOpenChangeComplete(nextOpen);
              // An exit-animation callback that reopens right after it unmounts.
              if (!nextOpen && reopenOnComplete) {
                reopenOnComplete = false;
                setOpen(true);
              }
            }}
          />
        );
      }

      const { user } = renderWithUser(() => <App />);
      await act(() => actionsRef.current!.close());
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await act(() => actionsRef.current!.unmount());
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(closes(onOpenChangeComplete)).toBe(1);

      optOut = false;
      await user.click(screen.getByRole('option'));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(closes(onOpenChangeComplete)).toBe(2);
    });

    it('completes closing once when `unmount` is called twice in one batch', async () => {
      const actionsRef = createRef<Actions>();
      const onOpenChangeComplete = vi.fn();
      const { user } = renderWithUser(() => (
        <Popup
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        />
      ));

      await user.click(screen.getByRole('option'));
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await act(() => {
        actionsRef.current!.unmount();
        actionsRef.current!.unmount();
      });
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(closes(onOpenChangeComplete)).toBe(1);
    });
  });

  describe('conformance', () => {
    // Upstream `popupConformanceTests` (Select keeps the popup mounted and hidden once it has
    // opened: `alwaysMounted: 'only-after-open'`).
    const openReason = REASONS.triggerPress;
    const expectedPopupRole = 'listbox';
    const expectedAriaHasPopupValue = 'listbox';

    interface OpenChangeEventDetails {
      reason: string;
      cancel: () => void;
      preventUnmountOnClose: () => void;
    }

    interface TestedComponentProps {
      root?: {
        actionsRef?: { current: Actions | null };
        open?: boolean;
        defaultOpen?: boolean;
        onOpenChange?: (open: boolean, eventDetails: OpenChangeEventDetails) => void;
        onOpenChangeComplete?: (open: boolean) => void;
      };
      popup?: { class?: string; id?: string; 'data-testid'?: string };
      trigger?: { 'data-testid'?: string };
      portal?: { keepMounted?: boolean };
    }

    function createComponent(props: TestedComponentProps) {
      return (
        <Select.Root
          actionsRef={props.root?.actionsRef}
          open={props.root?.open}
          defaultOpen={props.root?.defaultOpen}
          onOpenChange={props.root?.onOpenChange as any}
          onOpenChangeComplete={props.root?.onOpenChangeComplete}
        >
          <Select.Trigger data-testid={props.trigger?.['data-testid']}>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup
                data-testid={props.popup?.['data-testid']}
                id={props.popup?.id}
                class={props.popup?.class}
              >
                <Select.Item>Item</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );
    }

    function getConformanceTrigger() {
      return screen.getByTestId('trigger');
    }

    function getConformancePopup() {
      return screen.queryByTestId('popup');
    }

    const renderComponent = (initialProps: TestedComponentProps) =>
      renderWithProps(
        (props: TestedComponentProps) =>
          createComponent({
            get root() {
              return props.root;
            },
            get portal() {
              return props.portal;
            },
            get trigger() {
              return { 'data-testid': 'trigger', ...props.trigger };
            },
            get popup() {
              return { 'data-testid': 'popup', ...props.popup };
            },
          }),
        initialProps,
      );

    // Popups that stay mounted after opening are hidden instead of removed when they close.
    const expectPopupClosed = () => {
      const popup = getConformancePopup();
      if (popup) {
        expect(popup).not.toBeVisible();
      }
    };

    describe('Popup conformance', () => {
      describe('IME dismissal', () => {
        it('dismisses after a composition is dropped without compositionend', async () => {
          const handleOpenChange = vi.fn();
          const { user } = renderComponent({
            root: { defaultOpen: true, onOpenChange: handleOpenChange },
          });
          const popup = getConformancePopup()!;
          expect(popup).toBeVisible();

          fireEvent.compositionStart(popup);
          await user.keyboard('[Escape]');

          await waitFor(expectPopupClosed);
          expect(handleOpenChange).toHaveBeenCalledWith(
            false,
            expect.objectContaining({ reason: REASONS.escapeKey }),
          );
        });

        it.each([
          { name: 'isComposing', isComposing: true, keyCode: 27 },
          { name: 'keyCode 229', isComposing: false, keyCode: 229 },
        ])('preserves the popup for an IME Escape identified by $name', async (event) => {
          const handleOpenChange = vi.fn();
          renderComponent({ root: { defaultOpen: true, onOpenChange: handleOpenChange } });
          const popup = getConformancePopup()!;
          expect(popup).toBeVisible();

          fireEvent.keyDown(popup.ownerDocument.activeElement!, {
            key: 'Escape',
            isComposing: event.isComposing,
            keyCode: event.keyCode,
          });
          await flushMicrotasks();

          expect(popup).toBeVisible();
          expect(handleOpenChange).not.toHaveBeenCalled();
        });
      });

      describe('controlled mode', () => {
        it('opens the popup with the `open` prop', async () => {
          const { setProps } = renderComponent({ root: { open: false } });
          expect(getConformancePopup()).toBe(null);

          await setProps({ root: { open: true } });
          expect(getConformancePopup()).not.toBe(null);
        });

        it('reports every close request while `open={true}` keeps the popup open', async () => {
          const handleOpenChange = vi.fn();
          const { user } = renderComponent({
            root: { open: true, onOpenChange: handleOpenChange },
          });

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getConformancePopup()).toBeVisible();
          await user.keyboard('[Escape]');

          await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledTimes(2);
          });
          expect(handleOpenChange).toHaveBeenNthCalledWith(
            2,
            false,
            expect.objectContaining({ reason: REASONS.escapeKey }),
          );
        });
      });

      describe('prop: defaultOpen', () => {
        it('opens initially and remains uncontrolled', async () => {
          const { user } = renderComponent({ root: { defaultOpen: true } });
          expect(getConformancePopup()).toBeVisible();

          await user.keyboard('[Escape]');
          await waitFor(expectPopupClosed);
        });

        it('is ignored when `open={false}` is passed', () => {
          renderComponent({ root: { defaultOpen: true, open: false } });
          expect(getConformancePopup()).toBe(null);
        });

        it('is ignored when `open={true}` is passed, so Escape cannot close', async () => {
          const { user } = renderComponent({ root: { defaultOpen: true, open: true } });
          expect(getConformancePopup()).toBeVisible();

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getConformancePopup()).toBeVisible();
        });
      });

      describe('prop: onOpenChange', () => {
        it('is called with the new open state and the change details', async () => {
          const handleOpenChange = vi.fn();
          const { user } = renderComponent({ root: { onOpenChange: handleOpenChange } });
          expect(handleOpenChange).not.toHaveBeenCalled();

          await user.click(getConformanceTrigger());
          await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledTimes(1);
          });
          await waitFor(() => {
            expect(getConformancePopup()).toBeVisible();
          });
          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange).toHaveBeenNthCalledWith(
            1,
            true,
            expect.objectContaining({ reason: openReason, trigger: getConformanceTrigger() }),
          );

          await user.keyboard('[Escape]');
          await waitFor(expectPopupClosed);
          expect(handleOpenChange).toHaveBeenCalledTimes(2);
          expect(handleOpenChange).toHaveBeenNthCalledWith(
            2,
            false,
            expect.objectContaining({
              reason: REASONS.escapeKey,
              trigger: getConformanceTrigger(),
            }),
          );
        });

        it('keeps the popup closed when the open change is canceled', async () => {
          const handleOpenChange = vi.fn(
            (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
              if (nextOpen) {
                eventDetails.cancel();
              }
            },
          );
          const { user } = renderComponent({ root: { onOpenChange: handleOpenChange } });

          await user.click(getConformanceTrigger());
          await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledTimes(1);
          });
          await flushMicrotasks();

          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange).toHaveBeenNthCalledWith(
            1,
            true,
            expect.objectContaining({ reason: openReason }),
          );
          expectPopupClosed();
          expect(getConformanceTrigger()).not.toHaveAttribute('data-popup-open');
        });

        it('is not called when the `close` action is called while closed', async () => {
          const handleOpenChange = vi.fn();
          const actionsRef = createRef<{ close: () => void; unmount: () => void }>();
          renderComponent({ root: { actionsRef, onOpenChange: handleOpenChange } });

          await act(() => actionsRef.current!.close());

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getConformanceTrigger()).not.toHaveAttribute('data-popup-open');
        });

        it('is not called when the `close` action is called after the `open` prop opened and closed the popup', async () => {
          const handleOpenChange = vi.fn();
          const actionsRef = createRef<{ close: () => void; unmount: () => void }>();
          const rootProps = (open: boolean) => ({ actionsRef, onOpenChange: handleOpenChange, open });
          const { user, setProps } = renderComponent({ root: rootProps(false) });

          // The parent ignores this open, so it stays recorded as a pending request until the prop
          // opens and closes the popup.
          await user.click(getConformanceTrigger());
          await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
          });
          await setProps({ root: rootProps(true) });
          await setProps({ root: rootProps(false) });
          await waitFor(expectPopupClosed);
          handleOpenChange.mockClear();

          await act(() => actionsRef.current!.close());

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getConformanceTrigger()).not.toHaveAttribute('data-popup-open');
        });

        it('is called when the `close` action is called while open', async () => {
          const handleOpenChange = vi.fn();
          const actionsRef = createRef<{ close: () => void; unmount: () => void }>();
          renderComponent({
            root: { actionsRef, defaultOpen: true, onOpenChange: handleOpenChange },
          });
          expect(getConformancePopup()).toBeVisible();

          await act(() => actionsRef.current!.close());

          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange).toHaveBeenNthCalledWith(
            1,
            false,
            expect.objectContaining({ reason: REASONS.imperativeAction }),
          );
          await waitFor(expectPopupClosed);
        });

        it('closes normally after a canceled close that asked to keep the popup mounted', async () => {
          let closeCount = 0;
          const handleOpenChange = vi.fn(
            (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
              if (!nextOpen) {
                closeCount += 1;
                if (closeCount === 1) {
                  eventDetails.preventUnmountOnClose();
                  eventDetails.cancel();
                }
              }
            },
          );
          const handleOpenChangeComplete = vi.fn();
          const { user } = renderComponent({
            root: {
              defaultOpen: true,
              onOpenChange: handleOpenChange,
              onOpenChangeComplete: handleOpenChangeComplete,
            },
          });

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getConformancePopup()).toBeVisible();

          await user.keyboard('[Escape]');
          await waitFor(() => {
            expect(closeCount).toBe(2);
          });
          await waitFor(expectPopupClosed);
          await waitFor(() => {
            expect(handleOpenChangeComplete).toHaveBeenCalledWith(false);
          });
        });

        it.each([
          { name: 'one close', closes: 1, synchronous: false },
          { name: 'a second close during the wait', closes: 2, synchronous: false },
          {
            name: 'a synchronous request and a second close during the wait',
            closes: 2,
            synchronous: true,
          },
        ])(
          'keeps a controlled popup from finishing its close when it prevents unmounting after an await, with $name',
          async ({ closes, synchronous }) => {
            const onOpenChangeComplete = vi.fn();
            const handleClose = vi.fn();

            function App() {
              const [open, setOpen] = createSignal(true);
              let busy = false;
              return createComponent({
                root: {
                  get open() {
                    return open();
                  },
                  onOpenChangeComplete,
                  onOpenChange: async (nextOpen, eventDetails) => {
                    if (nextOpen) {
                      setOpen(true);
                      return;
                    }
                    handleClose();
                    // A close that arrives while the first one waits is ignored.
                    if (busy) {
                      return;
                    }
                    busy = true;
                    if (synchronous) {
                      eventDetails.preventUnmountOnClose();
                    }
                    await wait(50);
                    if (!synchronous) {
                      eventDetails.preventUnmountOnClose();
                    }
                    setOpen(false);
                  },
                },
                trigger: { 'data-testid': 'trigger' },
                popup: { 'data-testid': 'popup' },
              });
            }

            const { user } = renderWithUser(() => <App />);
            expect(getConformancePopup()).toBeVisible();

            await user.keyboard('[Escape]');
            if (closes === 2) {
              await user.keyboard('[Escape]');
            }
            expect(handleClose).toHaveBeenCalledTimes(closes);
            await waitFor(() => {
              expect(getConformanceTrigger()).not.toHaveAttribute('data-popup-open');
            });
            await act(() => wait(100));

            expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
            expect(getConformancePopup()).not.toBe(null);
          },
        );
      });

      describe('ARIA attributes', () => {
        it(`has the ${expectedPopupRole} role on the popup`, () => {
          renderComponent({ root: { open: true } });
          expect(getConformancePopup()).toHaveAttribute('role', expectedPopupRole);
        });

        it('has the `aria-controls` attribute on the trigger', () => {
          renderComponent({ root: { open: true } });
          expect(getConformanceTrigger()).toHaveAttribute('aria-controls', getConformancePopup()?.id);
        });

        it('opens on trigger click and sets `aria-expanded` on the trigger', async () => {
          const { user } = renderComponent({});
          const trigger = getConformanceTrigger();
          expect(getConformancePopup()).toBe(null);
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
          await user.click(trigger);
          await waitFor(() => {
            expect(getConformancePopup()).toHaveAttribute('data-open', '');
          });
          expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });

        it('has the `aria-haspopup` attribute on the trigger', async () => {
          const { setProps } = renderComponent({ root: { open: false } });
          expect(getConformanceTrigger()).toHaveAttribute('aria-haspopup', expectedAriaHasPopupValue);

          await setProps({ root: { open: true } });
          expect(getConformanceTrigger()).toHaveAttribute('aria-haspopup', expectedAriaHasPopupValue);
        });

        it('allows a custom `id` prop', () => {
          renderComponent({ root: { open: true }, popup: { id: 'TestId' } });
          expect(getConformancePopup()).toHaveAttribute('id', 'TestId');
          expect(getConformanceTrigger()).toHaveAttribute('aria-controls', 'TestId');
        });
      });

      describe('prop: onOpenChangeComplete without animations', () => {
        // Upstream counts React commits with a Profiler (React-only API). Solid has no commits: the
        // equivalent contract is that the callback runs once the popup is in the DOM.
        it('is called on open once the popup is mounted', async () => {
          let popupMountedOnComplete: boolean | null = null;
          const onOpenChangeComplete = (open: boolean) => {
            if (open) {
              popupMountedOnComplete = getConformancePopup() !== null;
            }
          };
          const { setProps } = renderComponent({ root: { open: false, onOpenChangeComplete } });
          await setProps({ root: { open: true, onOpenChangeComplete } });
          await waitFor(() => {
            expect(popupMountedOnComplete).not.toBe(null);
          });
          expect(popupMountedOnComplete).toBe(true);
        });

        it('is not called on mount when closed', () => {
          const onOpenChangeComplete = vi.fn();
          renderComponent({ root: { onOpenChangeComplete } });
          expect(onOpenChangeComplete).not.toHaveBeenCalled();
        });

        it('is called on open when there is no enter animation', async () => {
          const onOpenChangeComplete = vi.fn();
          const { setProps } = renderComponent({ root: { open: false, onOpenChangeComplete } });

          await setProps({ root: { open: true, onOpenChangeComplete } });
          await waitFor(() => {
            expect(onOpenChangeComplete).toHaveBeenCalled();
          });
          await flushMicrotasks();
          expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
        });

        it('is called on close when there is no exit animation', async () => {
          const onOpenChangeComplete = vi.fn();
          const { setProps } = renderComponent({ root: { open: true, onOpenChangeComplete } });

          await setProps({ root: { open: false, onOpenChangeComplete } });
          await waitFor(expectPopupClosed);
          await waitFor(() => {
            expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
          });
          expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false]]);
        });
      });

      // jsdom has no CSS animations (`getAnimations`): the animated `onOpenChangeComplete` cases
      // and the exit-animation cases are browser-only upstream.
      it.skip('prop: onOpenChangeComplete with CSS animations (requires real animations)', () => {});
    });

    // Upstream `popupListConformanceTests` (itemRole 'option', DOM focus, selectable, the list
    // stops at its ends). The suite owns the scroller geometry, which item-aligned positioning
    // would override.
    describe('Popup list conformance', () => {
      const ITEMS = Array.from({ length: 12 }, (_, index) => `Item ${index}`);
      const ITEM_HEIGHT = 30;

      interface RenderListOptions {
        root?: Record<string, any> | undefined;
        items?: readonly string[] | undefined;
        disabledItems?: readonly string[] | undefined;
        onItemClick?: ((event: MouseEvent & { currentTarget: HTMLElement }) => void) | undefined;
        onOutsideClick?: (() => void) | undefined;
        wrap?: ((node: () => JSX.Element) => JSX.Element) | undefined;
      }

      function ListSelect(props: RenderListOptions) {
        const items = () => props.items ?? ITEMS;
        const disabledItems = () => props.disabledItems ?? [];
        return (
          <Select.Root
            defaultValue={props.root?.defaultValue}
            onValueChange={props.root?.onValueChange}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner alignItemWithTrigger={false}>
                <Select.Popup data-testid="popup">
                  <Select.List
                    data-testid="scroller"
                    style={{
                      height: '100px',
                      'max-height': 'none',
                      'overflow-y': 'auto',
                      padding: '0',
                    }}
                  >
                    <For each={items()}>
                      {(item) => (
                        <Select.Item
                          value={item}
                          disabled={disabledItems().includes(item)}
                          style={{
                            height: `${ITEM_HEIGHT}px`,
                            'box-sizing': 'border-box',
                            margin: '0',
                          }}
                          onClick={(event: MouseEvent & { currentTarget: HTMLElement }) =>
                            props.onItemClick?.(event)
                          }
                        >
                          <Select.ItemText>{item}</Select.ItemText>
                        </Select.Item>
                      )}
                    </For>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      function renderList(options: RenderListOptions = {}) {
        const content = () => (
          <div>
            <button type="button" data-testid="before">
              Before
            </button>
            <ListSelect {...options} />
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
        return screen.getByRole('option', { name: ITEMS[index] });
      }

      function getHighlightedIndex() {
        const highlighted = screen
          .queryAllByRole('option')
          .filter((item) => item.hasAttribute('data-highlighted'));
        if (highlighted.length > 1) {
          throw new Error(`Popup list conformance: ${highlighted.length} items are highlighted.`);
        }
        return highlighted.length ? ITEMS.indexOf(highlighted[0].textContent ?? '') : -1;
      }

      function getHighlightedText() {
        return screen
          .queryAllByRole('option')
          .find((item) => item.hasAttribute('data-highlighted'))?.textContent;
      }

      function getFocusOwner() {
        const active = document.activeElement;
        if (active === getTrigger()) {
          return 'trigger';
        }
        if (screen.queryAllByRole('option').some((item) => item.contains(active))) {
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
          expect(screen.getAllByRole('option')[0]).toBeVisible();
        });
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
        const onValueChange = vi.fn();
        return {
          activated,
          onValueChange,
          options: {
            root: { onValueChange },
            onItemClick: (event: MouseEvent & { currentTarget: HTMLElement }) => {
              activated.push(event.currentTarget.textContent ?? '');
            },
          } satisfies RenderListOptions,
          expectNothingCommitted() {
            expect(activated).toEqual([]);
            expect(onValueChange).not.toHaveBeenCalled();
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
          expect(spies.onValueChange.mock.calls.map(([value]) => value)).toEqual([ITEMS[6]]);
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
          const onValueChange = vi.fn();
          const { user } = renderList({
            root: { onValueChange },
            disabledItems: [ITEMS[1]],
            onItemClick,
          });
          await openWithMouse(user);
          expect(getItem(1)).toHaveAttribute('aria-disabled', 'true');

          await user.hover(getItem(1));
          await user.keyboard('{Enter}');
          await settle();

          expect(onItemClick).not.toHaveBeenCalled();
          expect(onValueChange).not.toHaveBeenCalled();

          await user.click(getItem(1));
          await settle();

          expect(onItemClick).not.toHaveBeenCalled();
          expect(onValueChange).not.toHaveBeenCalled();
          expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
          expect(getItem(1)).not.toHaveAttribute('data-selected');

          // An enabled item must reach the same callbacks, so disconnected handlers cannot pass.
          await user.click(getItem(2));
          expect(onItemClick).toHaveBeenCalledTimes(1);
          expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([ITEMS[2]]);
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

        // Skipped (need real browser pointer input and layout): 'keeps the keyboard highlight
        // while the list scrolls under a resting pointer', 'does not scroll the list when
        // hovering a partially visible item at either edge'.
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

        it.each(['{ArrowDown}', '{ArrowUp}'])('opens on the selected item with %s', async (key) => {
          const { user } = renderList({ root: { defaultValue: ITEMS[8] } });
          await focusTrigger();

          await user.keyboard(key);
          await waitForOpen();

          await waitFor(() => {
            expect(getHighlightedIndex()).toBe(8);
          });
        });

        it('marks only the selected item as selected', async () => {
          const { user } = renderList({ root: { defaultValue: ITEMS[8] } });
          await openWithMouse(user);

          expect(getItem(8)).toHaveAttribute('aria-selected', 'true');
          expect(getItem(2)).toHaveAttribute('aria-selected', 'false');
        });

        // Skipped (need layout): scrolling the last/selected item into view when opening.
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
          expect(spies.onValueChange.mock.calls.map(([value]) => value)).toEqual([
            ITEMS[start + 1],
          ]);
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
            flush();
          }
        });

        // Skipped (need layout): End/Home/arrow navigation and typeahead scrolling items into
        // view.
      });

      describe('list boundaries', () => {
        it('stops past the first item', async () => {
          const { user } = renderList();
          const start = await openWithKeyboard(user);
          expect(start).toBe(0);

          await user.keyboard('{ArrowUp}');

          await waitFor(() => {
            expect(getHighlightedIndex()).toBe(0);
          });
        });

        it('stops past the last item', async () => {
          const { user } = renderList();
          await focusTrigger();
          await user.keyboard('{ArrowUp}');
          await waitForOpen();
          await waitFor(() => {
            expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
          });

          await user.keyboard('{ArrowDown}');

          await waitFor(() => {
            expect(getHighlightedIndex()).toBe(ITEMS.length - 1);
          });
        });

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

        // Skipped (needs real browser input): 'closes on a real outside click that the page
        // underneath does not receive'.

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
  });

  // Skipped: 'server-side rendering' (SSR is not exercised in this jsdom-only suite).

  describe('prop: defaultValue', () => {
    it('should select the item by default', async () => {
      render(() => (
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  describe('prop: value', () => {
    it('should select the item specified by the value prop', async () => {
      render(() => (
        <Select.Root value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });

    it('selects the controlled value when the popup is mounted on the initial render', () => {
      render(() => (
        <Select.Root defaultOpen value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('should update the selected item when the value prop changes', async () => {
      const [value, setValue] = createSignal('a');
      render(() => (
        <Select.Root value={value()}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );

      setValue('b');
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it.each([
      { name: 'single', multiple: false, initialValue: 'dave', nextValue: 'bob' },
      { name: 'multiple', multiple: true, initialValue: ['dave'], nextValue: ['bob'] },
    ])(
      'keeps a new controlled value and focus in $name mode when the previous item is removed in the same update',
      async ({ multiple, initialValue, nextValue }) => {
        const onValueChange = vi.fn();

        function Test() {
          const [options, setOptions] = createSignal(['alice', 'bob', 'carol', 'dave']);
          const [value, setValue] = createSignal<string | string[] | null>(initialValue);

          return (
            <div>
              <Select.Root<string, boolean>
                multiple={multiple}
                value={value()}
                onValueChange={(next, details) => {
                  onValueChange(next, details);
                  setValue(next);
                }}
                open
                modal={false}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.List>
                        <For each={options()}>
                          {(option) => <Select.Item value={option}>{option}</Select.Item>}
                        </For>
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
              <button
                type="button"
                onClick={() => {
                  setOptions(['alice', 'bob']);
                  setValue(nextValue);
                }}
              >
                Update options and value
              </button>
              <output data-testid="value">{JSON.stringify(value())}</output>
            </div>
          );
        }

        const { user } = renderWithUser(() => <Test />);
        const dave = await screen.findByRole('option', { name: 'dave' });
        expect(dave).toHaveAttribute('data-selected');
        // Let the initial focus on the selected item (scheduled in a frame) land first.
        await waitFor(() => expect(dave).toHaveFocus());
        const alice = screen.getByRole('option', { name: 'alice' });
        await act(async () => alice.focus());
        expect(alice).toHaveFocus();
        expect(alice).toHaveAttribute('data-highlighted');

        // Simulate an external update without moving focus away from the surviving item.
        fireEvent.click(screen.getByRole('button', { name: 'Update options and value' }));
        await flushMicrotasks();

        expect(screen.getByTestId('value').textContent).toBe(JSON.stringify(nextValue));
        expect(screen.getByRole('option', { name: 'bob' })).toHaveAttribute('data-selected');
        expect(onValueChange).not.toHaveBeenCalled();
        expect(alice).toHaveFocus();
        expect(alice).toHaveAttribute('data-highlighted');

        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('option', { name: 'bob' })).toHaveFocus();
      },
    );

    it('uses the current multiple setting when options and value change together', async () => {
      const onValueChange = vi.fn();

      function Test() {
        const [multiple, setMultiple] = createSignal(false);
        const [value, setValue] = createSignal<string | string[]>('alice');
        const [options, setOptions] = createSignal(['alice', 'bob', 'carol']);

        return (
          <div>
            <Select.Root<string, boolean>
              multiple={multiple()}
              value={value()}
              onValueChange={onValueChange}
              open
              modal={false}
            >
              <Select.Trigger />
              <DefaultPopup>
                <For each={options()}>
                  {(option) => <Select.Item value={option}>{option}</Select.Item>}
                </For>
              </DefaultPopup>
            </Select.Root>
            <button
              type="button"
              onClick={() => {
                setMultiple(true);
                setValue(['alice']);
                setOptions(['alice', 'bob']);
              }}
            >
              Update selection
            </button>
          </div>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-multiselectable');
      expect(screen.getByRole('option', { name: 'carol' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Update selection' }));
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
      expect(screen.queryByRole('option', { name: 'carol' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'alice' })).toHaveAttribute('data-selected', '');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('uses the current comparator when options and value change together', async () => {
      const onValueChange = vi.fn();
      const alice = { id: 'alice' };
      const bob = { id: 'bob' };
      const carol = { id: 'carol' };

      function Test() {
        const [compareById, setCompareById] = createSignal(false);
        const [value, setValue] = createSignal(alice);
        const [options, setOptions] = createSignal([alice, bob, carol]);

        return (
          <div>
            <Select.Root
              value={value()}
              isItemEqualToValue={
                compareById()
                  ? (item: { id: string }, selected: { id: string }) => item.id === selected.id
                  : Object.is
              }
              onValueChange={onValueChange}
              open
              modal={false}
            >
              <Select.Trigger />
              <DefaultPopup>
                <For each={options()}>
                  {(option) => <Select.Item value={option}>{option.id}</Select.Item>}
                </For>
              </DefaultPopup>
            </Select.Root>
            <button
              type="button"
              onClick={() => {
                setCompareById(true);
                setValue({ id: 'bob' });
                setOptions([alice, bob]);
              }}
            >
              Update selection
            </button>
          </div>
        );
      }

      const { user } = renderWithUser(() => <Test />);
      await user.click(screen.getByRole('button', { name: 'Update selection' }));
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'bob' })).toHaveAttribute('data-selected', '');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should not update the internal value if the controlled value prop does not change', async () => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root value="a" onValueChange={onValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('a');

      await user.click(trigger);
      await user.click(await screen.findByRole('option', { name: 'b' }));

      expect(onValueChange).toHaveBeenCalledOnce();
      expect(onValueChange.mock.calls[0][0]).toBe('b');
      expect(trigger).toHaveTextContent('a');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(trigger);

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');
    });

    it('updates <Select.Value /> label when the value prop changes before the popup opens', async () => {
      const [value, setValue] = createSignal('b');
      render(() => (
        <Select.Root value={value()}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('b');

      setValue('a');
      await flushMicrotasks();

      expect(trigger).toHaveTextContent('a');
    });
  });

  describe('prop: itemToStringValue', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    function CountryItems(props: { items: typeof items }) {
      return (
        <DefaultPopup>
          <For each={props.items}>
            {(it) => <Select.Item value={it}>{it.country}</Select.Item>}
          </For>
        </DefaultPopup>
      );
    }

    it('uses itemToStringValue for form submission', () => {
      render(() => (
        <Select.Root
          name="country"
          defaultValue={items[0]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <CountryItems items={items} />
        </Select.Root>
      ));

      expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('US');
    });

    it('uses itemToStringValue for multiple selection form submission', () => {
      const { container } = render(() => (
        <Select.Root
          name="countries"
          multiple
          defaultValue={[items[0], items[1]]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <CountryItems items={items} />
        </Select.Root>
      ));

      const hiddenInputs = container.querySelectorAll('input[name="countries"]');
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs[0]).toHaveValue('US');
      expect(hiddenInputs[1]).toHaveValue('CA');
    });

    it('does not invoke itemToStringValue with the value array in multiple mode', () => {
      // A user `itemToStringValue` written for a single item throws if invoked with the whole
      // array. Rendering succeeding is the regression guard.
      const { container } = render(() => (
        <Select.Root
          name="countries"
          multiple
          defaultValue={[items[0], items[1]]}
          itemToStringValue={(item) => item.code.toUpperCase()}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <CountryItems items={items.slice(0, 2)} />
        </Select.Root>
      ));

      const hiddenInputs = container.querySelectorAll('input[name="countries"]');
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs[0]).toHaveValue('US');
      expect(hiddenInputs[1]).toHaveValue('CA');
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    function CountryItems() {
      return (
        <DefaultPopup>
          <For each={items}>{(it) => <Select.Item value={it}>{it.country}</Select.Item>}</For>
        </DefaultPopup>
      );
    }

    it('uses itemToStringLabel for trigger text when value is object', () => {
      render(() => (
        <Select.Root
          defaultValue={items[1]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <CountryItems />
        </Select.Root>
      ));

      expect(screen.getByTestId('trigger')).toHaveTextContent('Canada');
    });

    it('updates trigger text with itemToStringLabel after selecting object item', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root
          defaultOpen
          itemToStringLabel={(item: any) => item.country}
          itemToStringValue={(item: any) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <CountryItems />
        </Select.Root>
      ));

      await user.click(screen.getByRole('option', { name: 'Canada' }));
      flush();
      expect(screen.getByTestId('trigger')).toHaveTextContent('Canada');
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when an item is selected', async () => {
      const handleValueChange = vi.fn();

      function App() {
        const [value, setValue] = createSignal<string | null>('');

        return (
          <Select.Root
            value={value()}
            onValueChange={(newValue) => {
              setValue(newValue);
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <AB />
          </Select.Root>
        );
      }

      const { user } = renderWithUser(() => <App />);

      await user.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      const option = await screen.findByRole('option', { name: 'b' });
      // Upstream advances fake timers past the mouseup selection delay.
      await wait(200);
      await user.click(option);

      expect(handleValueChange.mock.calls[0][0]).toBe('b');
    });

    it('is not called twice on select', async () => {
      const handleValueChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      const option = await screen.findByRole('option', { name: 'b' });
      await wait(200);
      await user.click(option);

      expect(handleValueChange.mock.calls.length).toBe(1);
    });
  });

  describe('prop: defaultOpen', () => {
    it('should open the select by default', () => {
      render(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const listbox = screen.getByRole('listbox', { hidden: false });
      expect(listbox).toBeVisible();
      // `listbox` is implicitly vertical.
      expect(listbox).not.toHaveAttribute('aria-orientation');
    });

    it('should select an item and close when clicked while opened by default', async () => {
      const handleValueChange = vi.fn();

      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      expect(screen.queryByRole('listbox')).toBeVisible();

      const optionB = screen.getByRole('option', { name: 'b' });

      fireEvent.mouseMove(optionB);
      await user.click(optionB);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('b');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  it('does not dismiss when pressing portalled content inside the popup but outside the list', async () => {
    const { user } = renderWithUser(() => (
      <Select.Root defaultOpen>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                <Select.Item value="apple">Apple</Select.Item>
              </Select.List>
              <Portal mount={document.body}>
                <div>Portalled content</div>
              </Portal>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    await user.click(screen.getByText('Portalled content'));
    await flushMicrotasks();

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  describe('browser autofill', () => {
    it('should handle browser autofill', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root name="select">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const selectInput = screen.getByRole('textbox', { hidden: true });
      expect(selectInput).toHaveAttribute('name', 'select');
      fireEvent.change(selectInput, { target: { value: 'b' } });
      await flushMicrotasks();

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      });
    });

    it('ignores browser autofill in multiple mode', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Select.Root multiple name="select" onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const selectInput = screen.getByRole('textbox', { hidden: true });
      fireEvent.change(selectInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
    });

    it('leaves the value untouched when autofill matches no item', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Select.Root name="select" defaultValue="a" onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const selectInput = screen.getByRole('textbox', { hidden: true });
      fireEvent.change(selectInput, { target: { value: 'not-an-option' } });
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('trigger')).toHaveTextContent('a');
    });

    it('redirects focus to the trigger when the hidden input is focused', async () => {
      render(() => (
        <Select.Root name="select">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="a">a</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const selectInput = screen.getByRole('textbox', { hidden: true });

      await act(async () => {
        selectInput.focus();
      });

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('should pass autoComplete to the hidden input', () => {
      render(() => (
        <Select.Root name="country" autoComplete="country">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="US">United States</Select.Item>
            <Select.Item value="CA">Canada</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).toHaveAttribute('autocomplete', 'country');
    });

    const countries = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    it.each([
      { name: 'the value', autofill: 'CA' },
      { name: 'the label', autofill: 'Canada' },
    ])('should handle browser autofill with object values using $name', async ({ autofill }) => {
      const { user } = renderWithUser(() => (
        <Select.Root
          name="country"
          itemToStringLabel={(item: any) => item.country}
          itemToStringValue={(item: any) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <For each={countries}>
              {(it) => <Select.Item value={it}>{it.country}</Select.Item>}
            </For>
          </DefaultPopup>
        </Select.Root>
      ));

      const selectInput = screen.getByRole('textbox', { hidden: true });
      expect(selectInput).toHaveAttribute('name', 'country');
      fireEvent.change(selectInput, { target: { value: autofill } });
      await flushMicrotasks();

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
          'data-selected',
          '',
        );
      });
    });

    it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root name="country">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="US">United States</Select.Item>
            <Select.Item value="CA">Canada</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      fireEvent.change(screen.getByRole('textbox', { hidden: true }), {
        target: { value: 'canada' },
      });
      await flushMicrotasks();

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
          'data-selected',
          '',
        );
      });
    });

    it('matches browser autofill by serialized value before an earlier rendered label', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root name="country">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="CA">US</Select.Item>
            <Select.Item value="US">United States</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      fireEvent.change(screen.getByRole('textbox', { hidden: true }), {
        target: { value: 'US' },
      });
      await flushMicrotasks();

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(
          screen.getByRole('option', { name: 'United States', hidden: false }),
        ).toHaveAttribute('data-selected', '');
      });
      expect(screen.getByRole('option', { name: 'US', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('matches browser autofill when an earlier item has no rendered label', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root name="country">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="US">{null}</Select.Item>
            <Select.Item value="CA">Canada</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      fireEvent.change(screen.getByRole('textbox', { hidden: true }), {
        target: { value: 'Canada' },
      });
      await flushMicrotasks();

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
          'data-selected',
          '',
        );
      });
    });

    it('marks the field dirty and validates after successful autofill', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        return value === 'CA' ? null : 'error';
      });

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy}>
          <Select.Root name="country">
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <DefaultPopup>
              <Select.Item value="US">United States</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </DefaultPopup>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-dirty');

      fireEvent.change(screen.getByRole('textbox', { hidden: true }), {
        target: { value: 'CA' },
      });
      await flushMicrotasks();

      await waitFor(() => {
        expect(validateSpy).toHaveBeenCalled();
      });

      expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    it('does not update field state when autofill is canceled', async () => {
      render(() => (
        <Form errors={{ country: 'server error' }}>
          <Field.Root name="country">
            <Select.Root
              onValueChange={(_value, eventDetails) => {
                eventDetails.cancel();
              }}
            >
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <DefaultPopup>
                <Select.Item value="US">United States</Select.Item>
                <Select.Item value="CA">Canada</Select.Item>
              </DefaultPopup>
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-dirty');
      expect(screen.getByTestId('error')).toHaveTextContent('server error');

      fireEvent.change(screen.getByRole('textbox', { hidden: true }), {
        target: { value: 'CA' },
      });
      await flushMicrotasks();

      expect(trigger).not.toHaveAttribute('data-dirty');
      expect(screen.getByTestId('error')).toHaveTextContent('server error');
    });

    it.each([
      { lockState: 'readOnly', label: 'inside Field', withField: true },
      { lockState: 'disabled', label: 'inside Field', withField: true },
      { lockState: 'readOnly', label: 'outside Field', withField: false },
      { lockState: 'disabled', label: 'outside Field', withField: false },
    ] as const)(
      'ignores hidden-input autofill when $lockState $label',
      async ({ lockState, withField }) => {
        const onValueChange = vi.fn();
        const SelectUnderTest = () => (
          <Select.Root
            name={withField ? undefined : 'select'}
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            onValueChange={onValueChange}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <AB />
          </Select.Root>
        );

        render(() =>
          withField ? (
            <Form errors={{ select: 'test' }}>
              <Field.Root name="select">
                <SelectUnderTest />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ) : (
            <SelectUnderTest />
          ),
        );

        const selectInput = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
        expect(selectInput).toHaveAttribute('name', 'select');

        // Only the Field wrapper renders an error.
        const expectedError = withField ? 'test' : undefined;

        expect(screen.queryByTestId('error')?.textContent).toBe(expectedError);

        fireEvent.change(selectInput, { target: { value: 'b' } });
        await flushMicrotasks();

        expect(onValueChange).not.toHaveBeenCalled();
        expect(selectInput.value).toBe('');

        expect(screen.queryByTestId('error')?.textContent).toBe(expectedError);
      },
    );
  });

  describe('dirty state in multiple mode', () => {
    it('removes [data-dirty] after returning to the initial value', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root>
          <Select.Root multiple defaultOpen defaultValue={['a']}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <AB />
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const optionB = await screen.findByRole('option', { name: 'b' });

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionB);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      await user.click(optionB);
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-dirty');
      });
    });

    it('compares object values with isItemEqualToValue when clearing [data-dirty]', async () => {
      const items = [
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
      ];

      const { user } = renderWithUser(() => (
        <Field.Root>
          <Select.Root
            multiple
            defaultOpen
            // A distinct object reference from `items[0]`, but equal to it via `isItemEqualToValue`.
            defaultValue={[{ value: 'a', label: 'a' }]}
            isItemEqualToValue={(a, b) => a.value === b.value}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <DefaultPopup>
              <Select.Item value={items[0]}>a</Select.Item>
              <Select.Item value={items[1]}>b</Select.Item>
            </DefaultPopup>
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const optionA = await screen.findByRole('option', { name: 'a' });

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionA);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      await user.click(optionA);
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-dirty');
      });
    });

    it('does not invoke isItemEqualToValue with the value array when empty', async () => {
      const items = [
        { value: 'a', label: 'a' },
        { value: 'b', label: 'b' },
      ];

      const isItemEqualToValue = vi.fn((a: { value: string }, b: { value: string }) => {
        if (Array.isArray(b)) {
          throw new Error('isItemEqualToValue received the value array');
        }
        return a.value === b.value;
      });

      render(() => (
        <Select.Root
          multiple
          defaultOpen
          defaultValue={[]}
          isItemEqualToValue={isItemEqualToValue}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value={items[0]}>a</Select.Item>
            <Select.Item value={items[1]}>b</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      expect(screen.getByTestId('trigger')).not.toBeNull();
      expect(await screen.findAllByRole('option')).toHaveLength(2);
      await flushMicrotasks();
      expect(isItemEqualToValue).not.toHaveBeenCalledWith(expect.anything(), expect.any(Array));
    });

    it('keeps [data-dirty] when the same values return in a different order', async () => {
      const { user } = renderWithUser(() => (
        <Field.Root>
          <Select.Root multiple defaultOpen defaultValue={['a', 'b']}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <AB />
          </Select.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const optionA = await screen.findByRole('option', { name: 'a' });

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionA);
      await user.click(optionA);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });
    });
  });

  it.each(['disabled', 'readOnly'] as const)(
    'does not commit item selection when root is %s and forced open',
    async (lockState) => {
      const onValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root
          open
          onValueChange={onValueChange}
          disabled={lockState === 'disabled'}
          readOnly={lockState === 'readOnly'}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      await user.click(screen.getByRole('option', { name: 'b', hidden: false }));
      flush();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'b', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    },
  );

  describe('prop: modal', () => {
    it.each([
      { modal: true, hasBackdrop: true },
      { modal: false, hasBackdrop: false },
    ])('renders an internal backdrop: $hasBackdrop when modal is $modal', async ({ modal, hasBackdrop }) => {
      const { user } = renderWithUser(() => (
        <div>
          <Select.Root modal={modal}>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button>Outside</button>
        </div>
      ));

      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const positioner = screen.getByTestId('positioner');

      if (hasBackdrop) {
        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      } else {
        expect(positioner.previousElementSibling).toBe(null);
      }
    });
  });

  // Skipped: 'scroll locking' (upstream skips it in jsdom: it needs real layout and pointer input).

  describe('prop: actionsRef', () => {
    it('unmounts the select when the `unmount` method is called', async () => {
      const actionsRef = createRef<Actions>();

      const { user } = renderWithUser(() => (
        <Select.Root
          actionsRef={actionsRef}
          onOpenChange={(_, details) => details.preventUnmountOnClose()}
        >
          <Select.Trigger data-testid="trigger">Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item>1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(screen.queryByRole('listbox', { hidden: true })).not.toBe(null);

      await act(async () => {
        await waitSingleFrame();
        actionsRef.current!.unmount();
      });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('clears scroll arrow visibility when manually unmounted', async () => {
      const actionsRef = createRef<Actions>();

      const { user } = renderWithUser(() => (
        <Select.Root
          actionsRef={actionsRef}
          onOpenChange={(_, details) => details.preventUnmountOnClose()}
        >
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  ref={(node: HTMLDivElement) => {
                    Object.defineProperties(node, {
                      scrollTop: { configurable: true, value: 20, writable: true },
                      scrollHeight: { configurable: true, value: 100 },
                      clientHeight: { configurable: true, value: 50 },
                    });
                  }}
                >
                  <Select.Item value="one">One</Select.Item>
                  <Select.Item value="two">Two</Select.Item>
                </Select.List>
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByRole('combobox'));

      const list = await screen.findByRole('listbox');
      fireEvent.scroll(list);
      flush();

      const upArrow = screen.getByText('▲');
      const downArrow = screen.getByText('▼');

      await waitFor(() => {
        expect(upArrow).toHaveAttribute('data-visible');
      });
      await waitFor(() => {
        expect(downArrow).toHaveAttribute('data-visible');
      });

      await user.click(screen.getByRole('combobox'));
      await act(async () => {
        await waitSingleFrame();
        actionsRef.current!.unmount();
      });

      await waitFor(() => {
        expect(upArrow).not.toHaveAttribute('data-visible');
      });
      await waitFor(() => {
        expect(downArrow).not.toHaveAttribute('data-visible');
      });
    });

    it('does not leave a tabbable option while closed and kept mounted after tabbing out', async () => {
      const actionsRef = createRef<Actions>();

      const { user } = renderWithUser(() => (
        <div>
          <input />
          <Select.Root
            defaultValue="1"
            modal={false}
            actionsRef={actionsRef}
            onOpenChange={(_, details) => details.preventUnmountOnClose()}
          >
            <Select.Trigger>Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">1</Select.Item>
                  <Select.Item value="2">2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <input data-testid="after" />
        </div>
      ));

      await user.click(screen.getByRole('combobox'));

      const option = await screen.findByRole('option', { name: '1' });
      await act(async () => {
        option.focus();
      });
      await waitFor(() => {
        expect(option).toHaveFocus();
      });
      expect(option).toHaveAttribute('tabindex', '0');

      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      expect(screen.getByRole('listbox', { hidden: true })).not.toHaveAttribute('data-open');
      expect(option).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('scroll arrows', () => {
    it('normalizes overlapping fractional scroll ranges when toggling scroll arrow visibility', async () => {
      let scrollTop = 0.4;

      render(() => (
        <Select.Root open>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  ref={(node: HTMLDivElement) => {
                    Object.defineProperty(node, 'scrollTop', {
                      configurable: true,
                      get: () => scrollTop,
                      set: (value: number) => {
                        scrollTop = value;
                      },
                    });
                    Object.defineProperty(node, 'scrollHeight', {
                      value: 60.6,
                      configurable: true,
                    });
                    Object.defineProperty(node, 'clientHeight', {
                      value: 60,
                      configurable: true,
                    });
                  }}
                >
                  <Select.Item value="one">One</Select.Item>
                  <Select.Item value="two">Two</Select.Item>
                  <Select.Item value="three">Three</Select.Item>
                </Select.List>
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const list = screen.getByRole('listbox');
      const upArrow = screen.getByText('▲');
      const downArrow = screen.getByText('▼');

      await waitFor(() => {
        expect(upArrow).toHaveAttribute('data-visible');
      });
      expect(downArrow).not.toHaveAttribute('data-visible');

      scrollTop = 0.2;
      fireEvent.scroll(list);
      flush();

      // Both arrows are updated by the same scroll handler.
      await waitFor(() => {
        expect(downArrow).toHaveAttribute('data-visible');
      });
      expect(upArrow).not.toHaveAttribute('data-visible');
    });

    // Skipped: 'keeps a scroll arrow mounted while its exit animation runs' (needs real CSS
    // animations).
  });

  // Skipped: 'select inside popover' (upstream skips it in jsdom; Popover is ported separately).

  describe('prop: disabled', () => {
    it('sets the disabled state', async () => {
      const handleOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root defaultValue="b" onOpenChange={handleOpenChange} disabled>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');

      expect(document.activeElement).not.toBe(trigger);

      await user.click(trigger);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('updates the disabled state when the disabled prop changes', async () => {
      const handleOpenChange = vi.fn();
      function App() {
        const [disabled, setDisabled] = createSignal(true);
        return (
          <>
            <button onClick={() => setDisabled(!disabled())}>toggle</button>
            <Select.Root defaultValue="b" onOpenChange={handleOpenChange} disabled={disabled()}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <AB />
            </Select.Root>
          </>
        );
      }
      const { user } = renderWithUser(() => <App />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);

      await user.click(trigger);
      expect(handleOpenChange.mock.calls.length).toBe(0);

      await user.click(screen.getByRole('button', { name: 'toggle' }));
      flush();

      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).not.toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();

      await user.click(trigger);
      await waitFor(() => {
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });
    });
  });

  describe('prop: readOnly', () => {
    it('sets the readOnly state', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root defaultValue="b" readOnly>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      ));

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
      expect(trigger).toHaveAttribute('data-readonly');

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();
    });

    it('opens the popup when clicked', async () => {
      const handleOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root onOpenChange={handleOpenChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));

      const listbox = await screen.findByRole('listbox');
      expect(listbox).toHaveAttribute('aria-readonly', 'true');
      expect(handleOpenChange.mock.calls.length).toBe(1);
    });

    it('marks the listbox as readonly when rendered with Select.List', async () => {
      const { user } = renderWithUser(() => (
        <Select.Root readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <DefaultPopup>
            <Select.List>
              <Select.Item value="a">a</Select.Item>
            </Select.List>
          </DefaultPopup>
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));

      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
    });

    it.each([
      { name: 'ArrowDown', key: '{ArrowDown}' },
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: '[Space]' },
    ])('opens the popup with $name', async ({ key }) => {
      const handleOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root onOpenChange={handleOpenChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      await act(async () => {
        screen.getByTestId('trigger').focus();
      });

      await user.keyboard(key);

      expect(await screen.findByRole('listbox')).not.toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(1);
    });

    it('does not commit a value when an item is clicked in a popup the user opened', async () => {
      const handleValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      await user.click(screen.getByTestId('trigger'));

      const optionB = await screen.findByRole('option', { name: 'b' });
      await user.click(optionB);
      flush();

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(optionB).not.toHaveAttribute('data-selected');
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    it('does not commit a value with Enter on a highlighted item', async () => {
      const handleValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      await act(async () => {
        screen.getByTestId('trigger').focus();
      });

      await user.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');
      await user.keyboard('{Enter}');
      flush();

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    it('does not commit a value with typeahead on a closed trigger', async () => {
      const handleValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="apple">apple</Select.Item>
            <Select.Item value="banana">banana</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      await act(async () => {
        screen.getByTestId('trigger').focus();
      });

      await user.keyboard('b');
      flush();

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });

    // Upstream skips this in jsdom; it passes here.
    it('moves the highlight with typeahead while the popup is open', async () => {
      const handleValueChange = vi.fn();
      const { user } = renderWithUser(() => (
        <Select.Root defaultOpen onValueChange={handleValueChange} readOnly>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <DefaultPopup>
            <Select.Item value="apple">apple</Select.Item>
            <Select.Item value="banana">banana</Select.Item>
          </DefaultPopup>
        </Select.Root>
      ));

      const apple = await screen.findByRole('option', { name: 'apple' });
      const banana = screen.getByRole('option', { name: 'banana' });

      await act(async () => {
        apple.focus();
      });

      await user.keyboard('b');

      await waitFor(() => {
        expect(banana).toHaveAttribute('data-highlighted');
      });
      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('value').textContent).toBe('');
    });
  });

  describe('prop: id', () => {
    it('sets the id on the trigger', () => {
      render(() => (
        <Select.Root id="test-id">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <AB />
        </Select.Root>
      ));

      expect(screen.getByRole('combobox')).toHaveAttribute('id', 'test-id');
    });

    it('sets a hidden input id when name is not provided', () => {
      const { container } = render(() => (
        <Select.Root id="test-id">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      ));

      const hiddenInput = container.querySelector('input');
      expect(hiddenInput).toHaveAttribute('id', 'test-id-hidden-input');
      expect(hiddenInput).not.toHaveAttribute('name');
    });

    it('does not set a hidden input id when name is provided', () => {
      render(() => (
        <Select.Root id="test-id" name="country">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).not.toHaveAttribute('id');
    });
  });

  describe('hidden input type', () => {
    function HiddenInputSelect(props: {
      name?: string;
      autoComplete?: string;
      required?: boolean;
    }) {
      return (
        <Select.Root name={props.name} autoComplete={props.autoComplete} required={props.required}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      );
    }

    it('is hidden when the control takes no part in a form', () => {
      const { container } = render(() => <HiddenInputSelect />);

      expect(container.querySelector('input[aria-hidden]')).toHaveAttribute('type', 'hidden');
    });

    it.each([
      { name: 'name', props: { name: 'field' } },
      { name: 'autoComplete', props: { autoComplete: 'country' } },
      { name: 'required', props: { required: true } },
    ])('is a text input when $name is set', ({ props }) => {
      render(() => <HiddenInputSelect {...props} />);

      expect(screen.getByRole('textbox', { hidden: true })).not.toHaveAttribute('type');
    });

    it('is a text input inside Field.Root', () => {
      render(() => (
        <Field.Root>
          <HiddenInputSelect />
        </Field.Root>
      ));

      expect(screen.getByRole('textbox', { hidden: true })).not.toHaveAttribute('type');
    });

    // Skipped: 'stays focusable through inputRef' (upstream skips it in jsdom: jsdom lets
    // `type="hidden"` inputs take focus).
  });

  // Skipped: 'hidden input size' (needs layout; upstream skips it in jsdom too).
});

