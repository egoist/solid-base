import { createSignal, flush, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { PreviewCard } from '..';
import { REASONS } from '../../internals/reasons';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';
import { act, createRef, flushMicrotasks, renderWithUser } from '../../dialog/test-utils';

function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

function withFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

describe('<PreviewCard.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('keeps the payload while a controlled reopen moves to another trigger', async () => {
    const handle = PreviewCard.createHandle<string>();
    const [state, setState] = createSignal<{ open: boolean; triggerId: string | null }>({
      open: true,
      triggerId: 'first',
    });
    const payloads: Array<string | undefined> = [];
    const record = (payload: string | undefined) => {
      payloads.push(payload);
      return payload;
    };

    render(() => (
      <>
        <PreviewCard.Trigger handle={handle} id="first" payload="First">
          First
        </PreviewCard.Trigger>
        <PreviewCard.Trigger handle={handle} id="second" payload="Second">
          Second
        </PreviewCard.Trigger>
        <PreviewCard.Root handle={handle} open={state().open} triggerId={state().triggerId}>
          {/* Not destructured: `payload` is a live getter. */}
          {(arg: { readonly payload: string | undefined }) => (
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="popup">{record(arg.payload)}</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          )}
        </PreviewCard.Root>
      </>
    ));

    await act(() => setState({ open: false, triggerId: null }));

    payloads.length = 0;
    await act(() => setState({ open: true, triggerId: 'second' }));

    expect(payloads).not.toContain(undefined);
    expect(payloads.at(-1)).toBe('Second');
    expect(screen.getByTestId('popup')).toHaveTextContent('Second');
  });

  describe('data-instant', () => {
    function setupKeepMountedCard() {
      render(() => (
        <PreviewCard.Root>
          <PreviewCard.Trigger href="#" delay={0}>
            Link
          </PreviewCard.Trigger>
          <PreviewCard.Portal keepMounted>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      return screen.getByRole('link', { name: 'Link' });
    }

    it('is focus when the card opens from trigger focus', async () => {
      const trigger = setupKeepMountedCard();
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-instant');

      await act(() => trigger.focus());

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'focus');
    });

    it('is dismiss when Escape closes the card', async () => {
      const trigger = setupKeepMountedCard();
      await act(() => trigger.focus());
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
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerPreviewCard },
    { name: 'detached triggers', Component: DetachedTriggerPreviewCard },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersPreviewCard },
  ])('when using $name', ({ Component: TestPreviewCard }) => {
    describe('uncontrolled open', () => {
      withFakeTimers();

      it('should open when the trigger is hovered', async () => {
        render(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        render(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        fireEvent.mouseLeave(trigger);
        await flushMicrotasks();

        tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger is focused', async () => {
        render(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await act(() => trigger.focus());
        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is blurred', async () => {
        render(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await act(() => trigger.focus());
        tick(OPEN_DELAY);
        await flushMicrotasks();

        await act(() => trigger.blur());
        tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: onOpenChange', () => {
      withFakeTimers();

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestPreviewCard
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
          );
        }

        render(() => <App />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);
        await flushMicrotasks();

        tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestPreviewCard
                rootProps={{
                  get open() {
                    return open();
                  },
                  onOpenChange: (next) => setOpen(next),
                }}
              />
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByRole('button', { name: 'Show' }));
        flush();

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        await flushMicrotasks();

        tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestPreviewCard
              rootProps={{
                get open() {
                  return open();
                },
                onOpenChange: (next) => setOpen(next),
              }}
            />
          );
        }

        render(() => <App />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        await flushMicrotasks();

        tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not call onOpenChange again when the trigger is re-hovered while open', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestPreviewCard
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
          );
        }

        render(() => <App />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);

        // Leave and re-enter before the close delay runs out: the card stays open.
        fireEvent.mouseLeave(trigger);
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
      withFakeTimers();

      it('closes when the trigger is unhovered after opening by default', async () => {
        render(() => <TestPreviewCard rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseLeave(trigger);
        await flushMicrotasks();

        tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        render(() => <TestPreviewCard rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);
        await flushMicrotasks();

        tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: delay', () => {
      withFakeTimers();

      it('should open after delay with rest type by default', async () => {
        render(() => <TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

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
      withFakeTimers();

      it('should close after delay', async () => {
        render(() => <TestPreviewCard triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

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

    describe('dismissal', () => {
      withFakeTimers();

      it('reopens on hover after Escape closes it', async () => {
        render(() => <TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });
        flush();
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

    describe('prop: actionsRef', () => {
      it('unmounts the preview card when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = renderWithUser(() => (
          <TestPreviewCard
            rootProps={{
              actionsRef,
              onOpenChange: (_open, details) => {
                details.preventUnmountOnClose();
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
            }}
          />
        ));

        const trigger = screen.getByRole('link', { name: 'Link' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await act(() => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });

      it('closes the preview card when the `close` method is called', async () => {
        const onOpenChange = vi.fn();
        const actionsRef = createRef<PreviewCard.Root.Actions>();

        const { user } = renderWithUser(() => (
          <TestPreviewCard rootProps={{ actionsRef, onOpenChange }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('link', { name: 'Link' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        await act(() => actionsRef.current?.close());

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
  });

  describe('nested preview card interactions', () => {
    it('keeps the parent preview card open when clicking nested trigger', async () => {
      render(() => (
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="parent-popup">
                <PreviewCard.Root>
                  <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup data-testid="child-popup">Child content</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByRole('link', { name: 'Child' });

      fireEvent.click(childTrigger);
      await flushMicrotasks();

      // Parent popup should still be open after clicking the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when press starts in nested popup and ends outside', async () => {
      render(() => (
        <div>
          <button type="button" data-testid="outside">
            Outside
          </button>

          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <PreviewCard.Root defaultOpen>
                    <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      expect(screen.queryByTestId('child-popup')).not.toBe(null);

      const childPopup = screen.getByTestId('child-popup');
      const outside = screen.getByTestId('outside');

      fireEvent.pointerDown(childPopup, { pointerType: 'mouse', button: 0 });
      fireEvent.click(outside);
      flush();

      await waitFor(() => {
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      });
      expect(screen.queryByTestId('child-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when hovering nested trigger', async () => {
      render(() => (
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid="parent-positioner">
              <PreviewCard.Popup data-testid="parent-popup">
                <div>Parent content</div>
                <PreviewCard.Root>
                  <PreviewCard.Trigger href="#" data-testid="child-trigger">
                    Child
                  </PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup data-testid="child-popup">Child content</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByTestId('child-trigger');

      // Simulate hovering from parent content to child trigger
      fireEvent.pointerDown(childTrigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(childTrigger);
      fireEvent.mouseMove(childTrigger);
      await flushMicrotasks();

      // Parent popup should still be open after hovering the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    describe('race condition between close timers and hover-open logic', () => {
      withFakeTimers();

      it('keeps the parent open and re-opens the child when re-entering after partial close', async () => {
        render(() => (
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#" data-testid="parent-trigger">
              Parent
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <div>Parent content</div>
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#" data-testid="child-trigger">
                      Child
                    </PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        ));

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        fireEvent.mouseEnter(childTrigger);
        fireEvent.mouseMove(childTrigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        let childPopup = screen.getByTestId('child-popup').parentElement!;

        // Move mouse outside all previews
        fireEvent.mouseLeave(childPopup);
        fireEvent.mouseLeave(parentPopup);
        fireEvent.mouseMove(document.body);

        // Advance partway through close delay but not all the way
        tick(CLOSE_DELAY / 2);
        await flushMicrotasks();

        // Re-enter parent popup before it closes
        fireEvent.mouseEnter(parentPopup);

        // Let the child's close delay finish — child closes
        tick(CLOSE_DELAY);
        await flushMicrotasks();

        // Parent should still be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        // Hover child trigger again to re-open child
        fireEvent.mouseEnter(childTrigger);
        fireEvent.mouseMove(childTrigger);

        tick(OPEN_DELAY);
        await flushMicrotasks();

        // Parent and child should be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        childPopup = screen.getByTestId('child-popup').parentElement!;

        fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        fireEvent.mouseEnter(childPopup);

        tick(CLOSE_DELAY);

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).not.toBe(null);
      });
    });

    describe('synchronized closing', () => {
      withFakeTimers();

      it('parent popup closes as soon as the child popup closes', async () => {
        render(() => (
          <PreviewCard.Root>
            <PreviewCard.Trigger href="#" data-testid="parent-trigger">
              Parent
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <div>Parent content</div>
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#" data-testid="child-trigger">
                      Child
                    </PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        ));

        const parentTrigger = screen.getByTestId('parent-trigger');
        fireEvent.mouseEnter(parentTrigger);
        tick(OPEN_DELAY);

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        fireEvent.mouseLeave(parentTrigger, { relatedTarget: parentPopup });
        fireEvent.mouseEnter(parentPopup);
        fireEvent.mouseEnter(childTrigger);
        tick(OPEN_DELAY);

        const childPopup = screen.getByTestId('child-popup').parentElement!;

        fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        fireEvent.mouseEnter(childPopup);
        fireEvent.mouseLeave(childPopup);
        fireEvent.mouseMove(document.body);

        tick(CLOSE_DELAY + 10);
        await flushMicrotasks();

        expect(screen.queryByTestId('child-popup')).toBe(null);
        expect(screen.queryByTestId('parent-popup')).toBe(null);
      });
    });
  });

  describe('close requests', () => {
    it('reports the active trigger for an Escape close', async () => {
      const onOpenChange = vi.fn();
      const { user } = renderWithUser(() => (
        <PreviewCard.Root defaultOpen onOpenChange={onOpenChange}>
          <PreviewCard.Trigger href="#">Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      expect(screen.queryByText('Content')).not.toBe(null);

      await user.keyboard('[Escape]');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(screen.getByText('Trigger'));
    });
  });
});

type TestPreviewCardProps = {
  rootProps?: PreviewCard.Root.Props;
  triggerProps?: PreviewCard.Trigger.Props;
  portalProps?: PreviewCard.Portal.Props;
  positionerProps?: PreviewCard.Positioner.Props;
  popupProps?: PreviewCard.Popup.Props;
};

function parts(props: TestPreviewCardProps) {
  const triggerProps = () => omit(props.triggerProps ?? {}, 'children');
  return { triggerProps };
}

function PopupParts(props: TestPreviewCardProps): JSX.Element {
  return (
    <PreviewCard.Portal {...omit(props.portalProps ?? {}, 'children')}>
      {props.portalProps?.children}
      <PreviewCard.Positioner data-testid="positioner" {...props.positionerProps}>
        <PreviewCard.Popup data-testid="popup" {...omit(props.popupProps ?? {}, 'children')}>
          {props.popupProps?.children ?? 'Content'}
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  );
}

function ContainedTriggerPreviewCard(props: TestPreviewCardProps) {
  return (
    <PreviewCard.Root {...props.rootProps}>
      <PreviewCard.Trigger href="#" data-testid="trigger" {...parts(props).triggerProps()}>
        {props.triggerProps?.children ?? 'Link'}
      </PreviewCard.Trigger>
      <PopupParts {...props} />
    </PreviewCard.Root>
  );
}

function DetachedTriggerPreviewCard(props: TestPreviewCardProps) {
  const handle = PreviewCard.createHandle();
  return (
    <>
      <PreviewCard.Trigger
        href="#"
        data-testid="trigger"
        {...parts(props).triggerProps()}
        handle={handle}
      >
        {props.triggerProps?.children ?? 'Link'}
      </PreviewCard.Trigger>
      <PreviewCard.Root {...props.rootProps} handle={handle}>
        <PopupParts {...props} />
      </PreviewCard.Root>
    </>
  );
}

function MultipleDetachedTriggersPreviewCard(props: TestPreviewCardProps) {
  const handle = PreviewCard.createHandle();
  return (
    <>
      <PreviewCard.Trigger
        href="#"
        data-testid="trigger"
        {...parts(props).triggerProps()}
        handle={handle}
      >
        {props.triggerProps?.children ?? 'Link'}
      </PreviewCard.Trigger>
      <PreviewCard.Trigger href="#" data-testid="trigger-2" handle={handle}>
        Another link
      </PreviewCard.Trigger>
      <PreviewCard.Root {...props.rootProps} handle={handle}>
        <PopupParts {...props} />
      </PreviewCard.Root>
    </>
  );
}
