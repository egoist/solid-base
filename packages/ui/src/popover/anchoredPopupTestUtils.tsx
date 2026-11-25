import { For, Show, createMemo, createSignal, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import type userEvent from '@testing-library/user-event';
import { DirectionProvider } from '../direction-provider';
import type { Align, CollisionAvoidance, OffsetFunction, Side } from '../internals/anchorPositioning';
import { REASONS } from '../internals/reasons';
import {
  act,
  createRef,
  flushMicrotasks,
  renderWithProps,
  renderWithUser,
  wait,
  waitSingleFrame,
} from '../dialog/test-utils';

/**
 * Shared conformance suites of anchored popups (Popover, Tooltip, Preview Card…): Solid ports of
 * upstream's `popupConformanceTests`, `detachedTriggersConformanceTests`,
 * `positionerConformanceTests` and `viewportConformanceTests`.
 *
 * Every `createComponent` receives a live props object (getters): spread its fields on the parts.
 */

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * Lets pending positioning (`computePosition` resolves asynchronously) and Solid updates settle.
 * Upstream's async `render` does the same.
 */
export async function settle() {
  await act(() => wait(0));
}

/**
 * `renderWithProps`, settled after the initial render and after each `setProps`.
 */
export async function renderSettledWithProps<P extends object>(
  createComponent: (props: P) => JSX.Element,
  initialProps: P,
) {
  const result = renderWithProps(createComponent, initialProps);
  await settle();
  return {
    ...result,
    async setProps(next: Partial<P>) {
      await result.setProps(next);
      await settle();
    },
  };
}

/**
 * `renderWithUser`, settled after the initial render.
 */
export async function renderSettled(ui: () => JSX.Element) {
  const result = renderWithUser(ui);
  await settle();
  return result;
}

/**
 * Upstream's `enterWithMouse`.
 */
export function enterWithMouse(element: HTMLElement, init?: MouseEventInit) {
  fireEvent.pointerEnter(element, { pointerType: 'mouse', ...init });
  fireEvent.mouseEnter(element, init);
  fireEvent.mouseMove(element, init);
}

// ---------------------------------------------------------------------------------------------
// popupConformanceTests
// ---------------------------------------------------------------------------------------------

interface OpenChangeEventDetails {
  reason: string;
  cancel: () => void;
  preventUnmountOnClose: () => void;
}

export interface PopupConformanceRootProps {
  actionsRef?: { current: { close: () => void; unmount: () => void } | null };
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, eventDetails: OpenChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
}

export interface PopupConformanceComponentProps {
  root?: PopupConformanceRootProps;
  popup?: { class?: string; id?: string; 'data-testid'?: string };
  trigger?: { 'data-testid'?: string; delay?: number };
  portal?: { keepMounted?: boolean };
}

export interface PopupConformanceTestConfig {
  /**
   * Returns the tree to test. `props` is live: spread its fields on the parts.
   */
  createComponent: (props: PopupConformanceComponentProps) => JSX.Element;
  /**
   * How the popup is triggered.
   */
  triggerMouseAction: 'click' | 'hover';
  /**
   * Expected `role` attribute of the popup element.
   */
  expectedPopupRole?: string;
  /**
   * Expected `aria-haspopup` attribute of the trigger element.
   */
  expectedAriaHasPopupValue?: string;
  /**
   * The `reason` passed to `onOpenChange` when the trigger opens the popup.
   */
  openReason?: string;
}

function getConformanceTrigger() {
  return screen.getByTestId('trigger');
}

function getConformancePopup() {
  return screen.queryByTestId('popup');
}

export function popupConformanceTests(config: PopupConformanceTestConfig) {
  const { createComponent, triggerMouseAction, expectedPopupRole } = config;
  const expectedAriaHasPopupValue = config.expectedAriaHasPopupValue ?? expectedPopupRole;
  const openReason =
    config.openReason ??
    (triggerMouseAction === 'click' ? REASONS.triggerPress : REASONS.triggerHover);

  const withDefaults = (props: PopupConformanceComponentProps): PopupConformanceComponentProps => ({
    get root() {
      return props.root;
    },
    get portal() {
      return props.portal;
    },
    get trigger() {
      return {
        'data-testid': 'trigger',
        // Hover-opened popups open right away, so the tests don't depend on timers.
        ...(triggerMouseAction === 'hover' ? { delay: 0 } : {}),
        ...props.trigger,
      };
    },
    get popup() {
      return { 'data-testid': 'popup', ...props.popup };
    },
  });

  const renderComponent = (initialProps: PopupConformanceComponentProps) =>
    renderSettledWithProps(
      (props: PopupConformanceComponentProps) => createComponent(withDefaults(props)),
      initialProps,
    );

  const openWithTrigger = async (user: UserEvent) => {
    const trigger = getConformanceTrigger();
    if (triggerMouseAction === 'click') {
      await user.click(trigger);
    } else {
      enterWithMouse(trigger);
      await flushMicrotasks();
    }
  };

  const expectPopupClosed = () => {
    expect(getConformancePopup()).toBe(null);
  };

  describe('Popup conformance', () => {
    describe('IME dismissal', () => {
      it('dismisses after a composition is dropped without compositionend', async () => {
        const handleOpenChange = vi.fn();
        const { user } = await renderComponent({
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
        await renderComponent({ root: { defaultOpen: true, onOpenChange: handleOpenChange } });
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
        const { setProps } = await renderComponent({ root: { open: false } });
        expect(getConformancePopup()).toBe(null);

        await setProps({ root: { open: true } });
        expect(getConformancePopup()).not.toBe(null);
      });

      it('reports every close request while `open={true}` keeps the popup open', async () => {
        const handleOpenChange = vi.fn();
        const { user } = await renderComponent({
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
        const { user } = await renderComponent({ root: { defaultOpen: true } });
        expect(getConformancePopup()).toBeVisible();

        await user.keyboard('[Escape]');
        await waitFor(expectPopupClosed);
      });

      it('is ignored when `open={false}` is passed', async () => {
        await renderComponent({ root: { defaultOpen: true, open: false } });
        expect(getConformancePopup()).toBe(null);
      });

      it('is ignored when `open={true}` is passed, so Escape cannot close', async () => {
        const { user } = await renderComponent({ root: { defaultOpen: true, open: true } });
        expect(getConformancePopup()).toBeVisible();

        await user.keyboard('[Escape]');
        await flushMicrotasks();
        expect(getConformancePopup()).toBeVisible();
      });
    });

    describe('prop: onOpenChange', () => {
      it('is called with the new open state and the change details', async () => {
        const handleOpenChange = vi.fn();
        const { user } = await renderComponent({ root: { onOpenChange: handleOpenChange } });
        expect(handleOpenChange).not.toHaveBeenCalled();

        await openWithTrigger(user);
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
        const { user } = await renderComponent({ root: { onOpenChange: handleOpenChange } });

        await openWithTrigger(user);
        await waitFor(() => {
          expect(handleOpenChange).toHaveBeenCalledTimes(1);
        });
        await flushMicrotasks();

        // The open request was made, so a missing popup proves `cancel()` prevented it.
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
        await renderComponent({ root: { actionsRef, onOpenChange: handleOpenChange } });

        await act(() => actionsRef.current!.close());

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(getConformanceTrigger()).not.toHaveAttribute('data-popup-open');
      });

      it('is not called when the `close` action is called after the `open` prop opened and closed the popup', async () => {
        const handleOpenChange = vi.fn();
        const actionsRef = createRef<{ close: () => void; unmount: () => void }>();
        const rootProps = (open: boolean) => ({ actionsRef, onOpenChange: handleOpenChange, open });
        const { user, setProps } = await renderComponent({ root: rootProps(false) });

        // The parent ignores this open, so it stays recorded as a pending request until the prop
        // opens and closes the popup.
        await openWithTrigger(user);
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
        await renderComponent({
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

      if (triggerMouseAction === 'hover') {
        it('cancels a pending hover open when the `close` action is called', async () => {
          const handleOpenChange = vi.fn();
          const actionsRef = createRef<{ close: () => void; unmount: () => void }>();
          await renderComponent({
            root: { actionsRef, onOpenChange: handleOpenChange },
            trigger: { delay: 100 },
          });

          enterWithMouse(getConformanceTrigger());
          await act(async () => {
            actionsRef.current!.close();
            await wait(200);
          });

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getConformancePopup()).toBe(null);
        });

        it('cancels a pending hover open when the `close` action is called while the popup is still mounted', async () => {
          const handleOpenChange = vi.fn(
            (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
            },
          );
          const actionsRef = createRef<{ close: () => void; unmount: () => void }>();
          const { user } = await renderComponent({
            root: { actionsRef, defaultOpen: true, onOpenChange: handleOpenChange },
            trigger: { delay: 100 },
          });

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getConformancePopup()).not.toBe(null);
          expect(getConformancePopup()).not.toHaveAttribute('data-open');
          handleOpenChange.mockClear();

          enterWithMouse(getConformanceTrigger());
          await act(async () => {
            actionsRef.current!.close();
            await wait(200);
          });

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getConformancePopup()).not.toHaveAttribute('data-open');
        });

        it('reopens a popup that is still mounted once the hover delay ends without a `close` action', async () => {
          const handleOpenChange = vi.fn(
            (nextOpen: boolean, eventDetails: OpenChangeEventDetails) => {
              if (!nextOpen) {
                eventDetails.preventUnmountOnClose();
              }
            },
          );
          const { user } = await renderComponent({
            root: { defaultOpen: true, onOpenChange: handleOpenChange },
            trigger: { delay: 100 },
          });

          await user.keyboard('[Escape]');
          await flushMicrotasks();
          expect(getConformancePopup()).not.toBe(null);
          expect(getConformancePopup()).not.toHaveAttribute('data-open');
          handleOpenChange.mockClear();

          enterWithMouse(getConformanceTrigger());
          await act(() => wait(200));

          expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
          expect(getConformancePopup()).toHaveAttribute('data-open');
        });

        it('is not called when the pointer leaves the trigger before the hover delay ends', async () => {
          const handleOpenChange = vi.fn();
          await renderComponent({
            root: { onOpenChange: handleOpenChange },
            trigger: { delay: 100 },
          });
          const trigger = getConformanceTrigger();

          enterWithMouse(trigger);
          fireEvent.mouseLeave(trigger);
          await act(() => wait(200));

          expect(handleOpenChange).not.toHaveBeenCalled();
          expect(getConformancePopup()).toBe(null);
        });

        it('opens once the hover delay ends without a `close` action', async () => {
          const handleOpenChange = vi.fn();
          await renderComponent({
            root: { onOpenChange: handleOpenChange },
            trigger: { delay: 100 },
          });

          enterWithMouse(getConformanceTrigger());
          await act(() => wait(200));

          expect(handleOpenChange).toHaveBeenCalledWith(true, expect.anything());
          expect(getConformancePopup()).not.toBe(null);
        });
      }

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
        const { user } = await renderComponent({
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
        // A popup kept mounted doesn't finish closing until the `unmount` action is called.
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
            return createComponent(
              withDefaults({
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
              }),
            );
          }

          const { user } = await renderSettled(() => <App />);
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

    if (expectedPopupRole || triggerMouseAction === 'click') {
      describe('ARIA attributes', () => {
        if (expectedPopupRole) {
          it(`has the ${expectedPopupRole} role on the popup`, async () => {
            await renderComponent({ root: { open: true } });
            expect(getConformancePopup()).toHaveAttribute('role', expectedPopupRole);
          });
        }

        if (triggerMouseAction === 'click') {
          it('has the `aria-controls` attribute on the trigger', async () => {
            await renderComponent({ root: { open: true } });
            expect(getConformanceTrigger()).toHaveAttribute(
              'aria-controls',
              getConformancePopup()?.id,
            );
          });

          it('opens on trigger click and sets `aria-expanded` on the trigger', async () => {
            const { user } = await renderComponent({});
            const trigger = getConformanceTrigger();
            expect(getConformancePopup()).toBe(null);
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
            await user.click(trigger);
            await waitFor(() => {
              expect(getConformancePopup()).toHaveAttribute('data-open', '');
            });
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
          });

          if (expectedAriaHasPopupValue) {
            it('has the `aria-haspopup` attribute on the trigger', async () => {
              const { setProps } = await renderComponent({ root: { open: false } });
              expect(getConformanceTrigger()).toHaveAttribute(
                'aria-haspopup',
                expectedAriaHasPopupValue,
              );

              await setProps({ root: { open: true } });
              expect(getConformanceTrigger()).toHaveAttribute(
                'aria-haspopup',
                expectedAriaHasPopupValue,
              );
            });
          }

          it('allows a custom `id` prop', async () => {
            await renderComponent({ root: { open: true }, popup: { id: 'TestId' } });
            expect(getConformancePopup()).toHaveAttribute('id', 'TestId');
            expect(getConformanceTrigger()).toHaveAttribute('aria-controls', 'TestId');
          });
        }
      });
    }

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
        const { setProps } = await renderComponent({ root: { open: false, onOpenChangeComplete } });
        await setProps({ root: { open: true, onOpenChangeComplete } });
        await waitFor(() => {
          expect(popupMountedOnComplete).not.toBe(null);
        });
        expect(popupMountedOnComplete).toBe(true);
      });

      it('is not called on mount when closed', async () => {
        const onOpenChangeComplete = vi.fn();
        await renderComponent({ root: { onOpenChangeComplete } });
        expect(onOpenChangeComplete).not.toHaveBeenCalled();
      });

      it('is called on open when there is no enter animation', async () => {
        const onOpenChangeComplete = vi.fn();
        const { setProps } = await renderComponent({ root: { open: false, onOpenChangeComplete } });

        await setProps({ root: { open: true, onOpenChangeComplete } });
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenCalled();
        });
        await flushMicrotasks();
        expect(onOpenChangeComplete.mock.calls).toEqual([[true]]);
      });

      it('is called on close when there is no exit animation', async () => {
        const onOpenChangeComplete = vi.fn();
        const { setProps } = await renderComponent({ root: { open: true, onOpenChangeComplete } });

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
    it.skip('animations: hides the kept-mounted popup once the exit animation finishes (requires real animations)', () => {});
  });
}

// ---------------------------------------------------------------------------------------------
// detachedTriggersConformanceTests
// ---------------------------------------------------------------------------------------------

type OpenInteraction = 'click' | 'hover' | 'focus';

// Parts of different components have unrelated prop types; the suite only passes props that every
// tested component accepts.
type AnyComponent = (props: any) => JSX.Element;

export interface DetachedTriggersTestHandle {
  open(triggerId: string): void;
  close(): void;
  readonly isOpen: boolean;
}

export interface DetachedTriggersTestConfig {
  /**
   * Creates a new handle for the tested component, e.g. `Popover.createHandle`.
   */
  createHandle: () => DetachedTriggersTestHandle;
  Root: AnyComponent;
  Trigger: AnyComponent;
  Portal: AnyComponent;
  /**
   * Omit for popups that are not anchored to their trigger.
   */
  Positioner?: AnyComponent;
  Popup: AnyComponent;
  /**
   * Enables the inline scale check after switching triggers.
   */
  Viewport?: AnyComponent;
  /**
   * When provided, click-opened popups are closed with it, and the programmatic test checks that
   * focus returns to the element that opened the popup.
   */
  Close?: AnyComponent;
  /**
   * Props applied to every trigger, e.g. `{ href: '#', delay: 0 }`.
   */
  triggerProps?: Record<string, unknown>;
  /**
   * Interactions that open the popup from a trigger. The first one is the primary interaction.
   */
  openInteractions: readonly [OpenInteraction, ...OpenInteraction[]];
  /**
   * Whether triggers expose `aria-expanded` and `aria-controls`.
   */
  ariaExpanded: boolean;
  /**
   * Whether `handle.open()` throws for an unregistered trigger id (anchored popups) instead of
   * opening unassociated with a warning (Dialog).
   */
  throwOnMissingTrigger: boolean;
}

interface FixtureProps {
  mode: 'contained' | 'detached';
  handle?: DetachedTriggersTestHandle | undefined;
  triggerCount?: number;
  rootProps?: Record<string, unknown>;
  rootMounted?: boolean;
  /** Renders the detached triggers after the Root. */
  rootFirst?: boolean;
  /** Number of wrapper elements around the triggers. */
  nesting?: number;
  positionerProps?: Record<string, unknown>;
  withViewport?: boolean;
  /** Props applied to every trigger, over the config's `triggerProps`. */
  triggerProps?: Record<string, unknown>;
}

/**
 * Behavior shared by every popup that supports multiple triggers and detached triggers
 * (`handle` + `createHandle()`).
 *
 * Each multi-trigger scenario runs in two modes:
 * - `contained`: the triggers are children of the Root and no handle is involved.
 * - `detached`: the triggers are rendered outside the Root and connected to it with a handle.
 */
export function detachedTriggersConformanceTests(config: DetachedTriggersTestConfig) {
  const {
    createHandle,
    Root,
    Trigger,
    Portal,
    Positioner,
    Popup,
    Viewport,
    Close,
    openInteractions,
    ariaExpanded,
    throwOnMissingTrigger,
  } = config;

  const primaryInteraction = openInteractions[0];
  // Switching the active trigger must keep the popup mounted. Hover-opened popups close on
  // `mouseleave` before the next trigger is entered, so they switch with focus instead.
  const switchInteraction: OpenInteraction = openInteractions.includes('focus')
    ? 'focus'
    : primaryInteraction;

  function Fixture(props: FixtureProps) {
    const detached = () => props.mode === 'detached';
    const handle = () => (detached() ? props.handle : undefined);

    const triggers = () => (
      <For each={Array.from({ length: props.triggerCount ?? 2 }, (_, index) => index + 1)}>
        {(number) => (
          <Trigger
            {...config.triggerProps}
            {...props.triggerProps}
            handle={handle()}
            id={`trigger-${number}`}
            data-testid={`trigger-${number}`}
            payload={number}
          >
            {`Trigger ${number}`}
          </Trigger>
        )}
      </For>
    );

    // A memo: `setProps` notifies every prop, and the triggers must only remount when the
    // nesting actually changes.
    const nesting = createMemo(() => props.nesting ?? 0);
    const wrappedTriggers = () => {
      let result: () => JSX.Element = triggers;
      for (let level = 0; level < nesting(); level += 1) {
        const inner = result;
        result = () => <div>{inner()}</div>;
      }
      return result();
    };

    const renderPopup = (payload: () => unknown) => {
      const content = () => <span data-testid="content">{String(payload())}</span>;
      const popup = () => (
        <Popup data-testid="popup">
          <Show when={props.withViewport && Viewport} fallback={content()}>
            {Viewport ? <Viewport>{content()}</Viewport> : null}
          </Show>
          {Close ? <Close>Close popup</Close> : null}
        </Popup>
      );

      return (
        <Portal>
          {Positioner ? (
            <Positioner data-testid="positioner" {...props.positionerProps}>
              {popup()}
            </Positioner>
          ) : (
            popup()
          )}
        </Portal>
      );
    };

    const root = () => (
      <Show when={props.rootMounted ?? true}>
        <Root handle={handle()} {...props.rootProps}>
          {(arg: { readonly payload: unknown }) => (
            <>
              <Show when={!detached()}>{wrappedTriggers()}</Show>
              <span data-testid="root-payload">
                {arg.payload === undefined ? 'No payload' : String(arg.payload)}
              </span>
              {renderPopup(() => arg.payload)}
            </>
          )}
        </Root>
      </Show>
    );

    return (
      <Show when={detached()} fallback={root()}>
        <Show
          when={props.rootFirst}
          fallback={
            <>
              {wrappedTriggers()}
              {root()}
            </>
          }
        >
          {root()}
          {wrappedTriggers()}
        </Show>
      </Show>
    );
  }

  function getTrigger(number: number) {
    return screen.getByTestId(`trigger-${number}`);
  }

  async function openWith(interaction: OpenInteraction, user: UserEvent, trigger: HTMLElement) {
    if (interaction === 'click') {
      await user.click(trigger);
    } else if (interaction === 'hover') {
      await act(() => {
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);
      });
    } else {
      await act(() => trigger.focus());
    }
  }

  async function closeWith(interaction: OpenInteraction, user: UserEvent, trigger: HTMLElement) {
    if (interaction === 'click') {
      if (Close) {
        await user.click(screen.getByText('Close popup'));
      } else {
        await user.keyboard('{Escape}');
      }
    } else if (interaction === 'hover') {
      await act(() => {
        fireEvent.mouseLeave(trigger);
      });
    } else {
      await act(() => trigger.blur());
    }
  }

  async function switchTrigger(
    interaction: OpenInteraction,
    user: UserEvent,
    from: HTMLElement,
    to: HTMLElement,
  ) {
    if (interaction === 'hover') {
      await act(() => {
        fireEvent.mouseLeave(from);
        fireEvent.mouseEnter(to);
        fireEvent.mouseMove(to);
      });
    } else {
      await openWith(interaction, user, to);
    }
  }

  async function waitForPopupOpen() {
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  }

  async function waitForPopupClosed() {
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  }

  async function waitForContent(text: string) {
    await waitFor(() => {
      expect(screen.getByTestId('content').textContent).toBe(text);
    });
  }

  /**
   * Asserts that only the trigger with the given number is marked as the popup's active trigger
   * (or that none is, when `activeNumber` is `null`).
   */
  function expectActiveTrigger(activeNumber: number | null, triggerCount = 2) {
    const popupId = activeNumber === null ? null : screen.getByTestId('popup').id;

    for (let number = 1; number <= triggerCount; number += 1) {
      const trigger = getTrigger(number);
      const active = number === activeNumber;

      if (active) {
        expect(trigger).toHaveAttribute('data-popup-open');
      } else {
        expect(trigger).not.toHaveAttribute('data-popup-open');
      }

      if (ariaExpanded) {
        expect(trigger).toHaveAttribute('aria-expanded', String(active));
        if (active) {
          expect(popupId).not.toBe('');
          expect(trigger).toHaveAttribute('aria-controls', popupId);
        } else if (popupId !== null) {
          expect(trigger).not.toHaveAttribute('aria-controls');
        }
      }
    }
  }

  function countWarnings(consoleWarn: { mock: { calls: unknown[][] } }, text: string) {
    return consoleWarn.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes(text),
    ).length;
  }

  const renderFixture = (props: FixtureProps) =>
    renderSettledWithProps((p: FixtureProps) => <Fixture {...p} />, props);

  describe('detached triggers conformance', () => {
    describe.each([{ mode: 'contained' as const }, { mode: 'detached' as const }])(
      '$mode triggers',
      ({ mode }) => {
        // In `contained` mode the handle is never passed to the parts.
        const getHandle = () => (mode === 'detached' ? createHandle() : undefined);

        describe('multiple triggers', () => {
          it.each(openInteractions.map((interaction) => ({ interaction })))(
            'opens with any trigger on $interaction and marks only that trigger as active',
            async ({ interaction }) => {
              const { user } = await renderFixture({ mode, handle: getHandle(), triggerCount: 3 });

              expect(screen.queryByTestId('popup')).toBe(null);
              expectActiveTrigger(null, 3);

              for (const number of [1, 2, 3]) {
                const trigger = getTrigger(number);

                // eslint-disable-next-line no-await-in-loop
                await openWith(interaction, user, trigger);
                // eslint-disable-next-line no-await-in-loop
                await waitForPopupOpen();
                expectActiveTrigger(number, 3);

                // eslint-disable-next-line no-await-in-loop
                await closeWith(interaction, user, trigger);
                // eslint-disable-next-line no-await-in-loop
                await waitForPopupClosed();
                expectActiveTrigger(null, 3);
              }
            },
          );

          it('sets the payload of the active trigger and renders content based on it', async () => {
            const { user } = await renderFixture({ mode, handle: getHandle() });

            await openWith(primaryInteraction, user, getTrigger(1));
            await waitForContent('1');
            expect(screen.getByTestId('root-payload').textContent).toBe('1');

            await switchTrigger(primaryInteraction, user, getTrigger(1), getTrigger(2));
            await waitForContent('2');
            expect(screen.getByTestId('root-payload').textContent).toBe('2');
            expectActiveTrigger(2);
          });

          it('reports the trigger the popup was opened from for an Escape close', async () => {
            const onOpenChange = vi.fn();
            const { user } = await renderFixture({
              mode,
              handle: getHandle(),
              rootProps: { onOpenChange },
            });

            await openWith(primaryInteraction, user, getTrigger(2));
            await waitForPopupOpen();
            expectActiveTrigger(2);
            await user.keyboard('[Escape]');
            await waitForPopupClosed();

            expect(onOpenChange).toHaveBeenLastCalledWith(
              false,
              expect.objectContaining({ reason: REASONS.escapeKey, trigger: getTrigger(2) }),
            );
          });

          it('reports no trigger for a close once the trigger the popup was opened from has unmounted', async () => {
            const onOpenChange = vi.fn();
            const { user, setProps } = await renderFixture({
              mode,
              handle: getHandle(),
              rootProps: { onOpenChange },
            });

            await openWith(primaryInteraction, user, getTrigger(2));
            await waitForPopupOpen();
            await setProps({ triggerCount: 1 });
            // Some popups close as their active trigger unmounts; the others close on Escape.
            await user.keyboard('[Escape]');
            await waitForPopupClosed();

            expect(onOpenChange).toHaveBeenLastCalledWith(
              false,
              expect.objectContaining({ trigger: undefined }),
            );
          });

          it('reuses the popup DOM nodes when switching triggers', async () => {
            const { user } = await renderFixture({ mode, handle: getHandle() });

            await openWith(switchInteraction, user, getTrigger(1));
            await waitForContent('1');
            const popupElement = screen.getByTestId('popup');
            const positionerElement = screen.queryByTestId('positioner');

            await switchTrigger(switchInteraction, user, getTrigger(1), getTrigger(2));
            await waitForContent('2');
            expect(screen.getByTestId('popup')).toBe(popupElement);
            expect(screen.queryByTestId('positioner')).toBe(positionerElement);
          });

          it('marks the trigger matching a controlled `triggerId` as active', async () => {
            await renderFixture({
              mode,
              handle: getHandle(),
              rootProps: { open: true, triggerId: 'trigger-2' },
            });

            await waitForPopupOpen();
            expect(screen.getByTestId('content').textContent).toBe('2');
            expectActiveTrigger(2);
          });

          it('opens initially with the payload of a non-first `defaultTriggerId`', async () => {
            await renderFixture({
              mode,
              handle: getHandle(),
              triggerCount: 3,
              rootProps: { defaultOpen: true, defaultTriggerId: 'trigger-2' },
            });

            await waitForContent('2');
            expectActiveTrigger(2, 3);
          });

          // The positioner alignment checks of upstream need real layout; jsdom only checks the
          // active trigger and the focus return.
          it('allows controlling the open state and active trigger programmatically', async () => {
            const handle = getHandle();

            function Controlled() {
              const [open, setOpen] = createSignal(false);
              const [triggerId, setTriggerId] = createSignal<string | null>(null);

              return (
                <div>
                  <Fixture
                    mode={mode}
                    handle={handle}
                    rootProps={{
                      get open() {
                        return open();
                      },
                      get triggerId() {
                        return triggerId();
                      },
                      onOpenChange: (
                        nextOpen: boolean,
                        details: { trigger: Element | undefined },
                      ) => {
                        setTriggerId(details.trigger?.id ?? null);
                        setOpen(nextOpen);
                      },
                    }}
                    positionerProps={{ side: 'bottom', align: 'start' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(true);
                      setTriggerId('trigger-1');
                    }}
                  >
                    Open Trigger 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(true);
                      setTriggerId('trigger-2');
                    }}
                  >
                    Open Trigger 2
                  </button>
                  <button type="button" onClick={() => setOpen(false)}>
                    Close externally
                  </button>
                </div>
              );
            }

            const { user } = await renderSettled(() => <Controlled />);

            // Queried up front: a modal popup hides the rest of the page from the accessibility tree.
            const openTrigger1 = screen.getByRole('button', { name: 'Open Trigger 1' });
            const openTrigger2 = screen.getByRole('button', { name: 'Open Trigger 2' });
            const closeExternally = screen.getByRole('button', { name: 'Close externally' });

            await user.click(openTrigger1);
            await waitForContent('1');
            expectActiveTrigger(1);

            await user.click(openTrigger2);
            await waitForContent('2');
            expectActiveTrigger(2);

            if (Close) {
              await user.click(screen.getByText('Close popup'));
              await waitForPopupClosed();
              // Focus returns to the element that opened the popup.
              await waitFor(() => {
                expect(openTrigger2).toHaveFocus();
              });
            } else {
              await user.click(closeExternally);
              await waitForPopupClosed();
            }
            expectActiveTrigger(null);
          });

          it('keeps the trigger a controlled `triggerId` moved the popup to while it closes', async () => {
            const handle = getHandle();
            let moveToTrigger2 = () => {};

            function Controlled() {
              const [open, setOpen] = createSignal(false);
              const [triggerId, setTriggerId] = createSignal<string | null>(null);
              moveToTrigger2 = () => setTriggerId('trigger-2');

              return (
                <div>
                  <Fixture
                    mode={mode}
                    handle={handle}
                    rootProps={{
                      get open() {
                        return open();
                      },
                      get triggerId() {
                        return triggerId();
                      },
                      onOpenChange: (
                        nextOpen: boolean,
                        details: { preventUnmountOnClose: () => void },
                      ) => {
                        if (!nextOpen) {
                          // Keeps the closed popup mounted, so its content can be checked.
                          details.preventUnmountOnClose();
                          setTriggerId(null);
                        }
                        setOpen(nextOpen);
                      },
                    }}
                    positionerProps={{ side: 'bottom', align: 'start' }}
                  />
                </div>
              );
            }

            const { user } = await renderSettled(() => <Controlled />);

            await openWith(primaryInteraction, user, getTrigger(1));
            await waitForContent('1');
            await act(() => moveToTrigger2());
            await waitForContent('2');
            expectActiveTrigger(2);

            await user.keyboard('[Escape]');
            await waitFor(() => {
              expect(getTrigger(2)).not.toHaveAttribute('data-popup-open');
            });
            await flushMicrotasks();

            expect(screen.getByTestId('content').textContent).toBe('2');
          });

          if (Viewport) {
            // Needs real CSS animations to apply and clear the inline scale.
            it.skip('does not leave an inline scale style on the popup after switching triggers', () => {});
          }
        });
      },
    );

    describe('detached triggers', () => {
      describe('imperative actions on the handle', () => {
        it('opens by trigger id with its payload and closes', async () => {
          const handle = createHandle();
          await renderFixture({ mode: 'detached', handle });

          expect(screen.queryByTestId('popup')).toBe(null);
          expect(handle.isOpen).toBe(false);

          await act(() => handle.open('trigger-2'));
          await waitForContent('2');
          expect(handle.isOpen).toBe(true);
          expectActiveTrigger(2);

          await act(() => handle.close());
          await waitForPopupClosed();
          expect(handle.isOpen).toBe(false);
          expectActiveTrigger(null);
        });

        if (throwOnMissingTrigger) {
          it('throws when opened with an unregistered trigger id', async () => {
            const handle = createHandle();
            await renderFixture({ mode: 'detached', handle });

            expect(() => handle.open('missing')).toThrow(
              'was called with the trigger id "missing", but no matching trigger is registered',
            );
            expect(handle.isOpen).toBe(false);
          });
        } else {
          it('opens unassociated with a warning when opened with an unregistered trigger id', async () => {
            const handle = createHandle();
            await renderFixture({ mode: 'detached', handle });

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            try {
              await act(() => handle.open('missing'));
              expect(countWarnings(consoleWarn, 'No trigger found with id "missing"')).toBe(1);
            } finally {
              consoleWarn.mockRestore();
            }

            await waitForPopupOpen();
            expect(handle.isOpen).toBe(true);
            expectActiveTrigger(null);
          });
        }
      });

      describe('root ownership', () => {
        it('ignores imperative calls while no root is attached and follows the root across remounts', async () => {
          const handle = createHandle();
          const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

          try {
            handle.open('trigger-1');
            handle.close();
            expect(handle.isOpen).toBe(false);
            expect(countWarnings(consoleWarn, 'no root using this handle is mounted')).toBe(2);

            const { setProps } = await renderFixture({ mode: 'detached', handle, rootMounted: true });
            expect(screen.queryByTestId('popup')).toBe(null);
            expect(screen.getByTestId('root-payload').textContent).toBe('No payload');

            await act(() => handle.open('trigger-1'));
            await waitForContent('1');
            expect(handle.isOpen).toBe(true);

            // Unmounting the root while open detaches it from the handle.
            await setProps({ rootMounted: false });
            expect(handle.isOpen).toBe(false);
            expect(screen.queryByTestId('popup')).toBe(null);

            consoleWarn.mockClear();
            handle.open('trigger-1');
            handle.close();
            expect(handle.isOpen).toBe(false);
            expect(countWarnings(consoleWarn, 'no root using this handle is mounted')).toBe(2);

            // A remounted root starts closed, without the previous payload, and is controllable.
            await setProps({ rootMounted: true });
            expect(screen.queryByTestId('popup')).toBe(null);
            expect(screen.getByTestId('root-payload').textContent).toBe('No payload');

            await act(() => handle.open('trigger-2'));
            await waitForContent('2');
            expect(handle.isOpen).toBe(true);
          } finally {
            consoleWarn.mockRestore();
          }
        });

        if (openInteractions.includes('hover')) {
          it('drops a hover open pending when the root mounts and opens on the next hover', async () => {
            const delay = 50;
            const { setProps } = await renderFixture({
              mode: 'detached',
              handle: createHandle(),
              rootMounted: false,
              triggerProps: { delay },
            });
            const trigger = getTrigger(1);

            fireEvent.mouseEnter(trigger);
            fireEvent.mouseMove(trigger);
            await setProps({ rootMounted: true });

            await act(() => wait(delay * 2));
            expect(screen.queryByTestId('popup')).toBe(null);

            fireEvent.mouseLeave(trigger);
            fireEvent.mouseEnter(trigger);
            fireEvent.mouseMove(trigger);
            await waitForContent('1');
            expectActiveTrigger(1);
          });
        }

        it('registers a detached trigger declared after the root', async () => {
          const { user } = await renderFixture({
            mode: 'detached',
            handle: createHandle(),
            rootFirst: true,
          });

          await openWith(primaryInteraction, user, getTrigger(2));
          await waitForContent('2');
          expectActiveTrigger(2);
        });

        it('resolves a trigger still registered to the previous root during a transient overlap', async () => {
          const handle = createHandle();
          const openErrors: unknown[] = [];
          const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

          function OpenOnMount() {
            onSettled(() => {
              try {
                handle.open('trigger-2');
              } catch (error) {
                openErrors.push(error);
              }
            });
            return null;
          }

          function renderRoot(key: string) {
            const popup = () => <Popup>{key}</Popup>;
            return (
              <Root handle={handle}>
                <Portal>{Positioner ? <Positioner>{popup()}</Positioner> : popup()}</Portal>
              </Root>
            );
          }

          function App(props: { phase: 'outgoing' | 'overlap' | 'incoming' }) {
            return (
              <>
                <For each={[1, 2]}>
                  {(number) => (
                    <Trigger
                      {...config.triggerProps}
                      handle={handle}
                      id={`trigger-${number}`}
                      data-testid={`trigger-${number}`}
                    >
                      {`Trigger ${number}`}
                    </Trigger>
                  )}
                </For>
                <Show when={props.phase === 'outgoing' || props.phase === 'overlap'}>
                  {renderRoot('outgoing')}
                </Show>
                <Show when={props.phase === 'overlap' || props.phase === 'incoming'}>
                  {renderRoot('incoming')}
                  <OpenOnMount />
                </Show>
              </>
            );
          }

          try {
            const { setProps } = await renderSettledWithProps(
              (p: { phase: 'outgoing' | 'overlap' | 'incoming' }) => <App phase={p.phase} />,
              { phase: 'outgoing' as 'outgoing' | 'overlap' | 'incoming' },
            );
            await setProps({ phase: 'overlap' });

            expect(openErrors).toEqual([]);
            expect(countWarnings(consoleWarn, 'No trigger found')).toBe(0);
            expect(handle.isOpen).toBe(true);
            expect(getTrigger(2)).toHaveAttribute('data-popup-open');
            expect(getTrigger(1)).not.toHaveAttribute('data-popup-open');

            // Completing the handoff (the outgoing root unmounts) keeps the popup open and
            // associated.
            await setProps({ phase: 'incoming' });
            expect(handle.isOpen).toBe(true);
            expect(getTrigger(2)).toHaveAttribute('data-popup-open');
            expect(getTrigger(1)).not.toHaveAttribute('data-popup-open');
          } finally {
            consoleWarn.mockRestore();
          }
        });
      });

      describe('reparenting', () => {
        async function expectOpensAndCloses(user: UserEvent) {
          await openWith(primaryInteraction, user, getTrigger(1));
          await waitForPopupOpen();
          expectActiveTrigger(1, 1);
          await closeWith(primaryInteraction, user, getTrigger(1));
          await waitForPopupClosed();
        }

        it.each([
          { name: 'when wrappers are removed', nestings: [3, 2, 1, 0], recreateHandle: false },
          { name: 'when wrappers are added', nestings: [0, 1, 2, 3], recreateHandle: false },
          {
            name: 'during Fast Refresh-like handle recreation',
            nestings: [1, 1, 1],
            recreateHandle: true,
          },
          {
            name: 'when reparented during Fast Refresh-like handle recreation',
            nestings: [3, 2, 1, 0],
            recreateHandle: true,
          },
        ])('keeps a detached trigger working $name', async ({ nestings, recreateHandle }) => {
          const [initialNesting, ...nextNestings] = nestings;
          const { user, setProps } = await renderFixture({
            mode: 'detached',
            handle: createHandle(),
            triggerCount: 1,
            nesting: initialNesting,
          });

          await expectOpensAndCloses(user);

          for (const nesting of nextNestings) {
            // eslint-disable-next-line no-await-in-loop
            await setProps(recreateHandle ? { nesting, handle: createHandle() } : { nesting });
            // eslint-disable-next-line no-await-in-loop
            await expectOpensAndCloses(user);
          }
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// positionerConformanceTests
// ---------------------------------------------------------------------------------------------

export interface PositionerTestProps {
  'data-testid': string;
  side?: Side;
  align?: Align;
  sideOffset?: number | OffsetFunction;
  alignOffset?: number | OffsetFunction;
  collisionPadding?: number;
  collisionAvoidance?: CollisionAvoidance | undefined;
}

export interface PositionerTestComponentProps {
  /** Props to spread on the Root part. */
  root: { open: boolean };
  /** Props to spread on the element the positioner is anchored to. */
  trigger: { style: JSX.CSSProperties };
  /** Props to spread on the Positioner part. */
  positioner: PositionerTestProps;
  /** Props to spread on the Popup part. */
  popup: { style: JSX.CSSProperties };
  /** Whether to wrap the popup content in the component's Viewport part. */
  viewport: boolean;
}

export interface PositionerTestConfig {
  /**
   * Returns an open popup whose Positioner is anchored to an element at the viewport origin.
   */
  createComponent: (props: PositionerTestComponentProps) => JSX.Element;
  /**
   * Whether the component has a Viewport part.
   * @default false
   */
  viewport?: boolean;
  /**
   * The side the Positioner places the popup on when `side` isn't set.
   * @default 'bottom'
   */
  defaultSide?: Side;
  /**
   * The `collisionAvoidance` default the Positioner uses.
   * @default 'dropdown'
   */
  defaultCollisionAvoidance?: 'popup' | 'dropdown';
}

/**
 * Tests the anchor positioning behavior that every `*.Positioner` part shares. Upstream runs all of
 * it in the browser only (real layout); jsdom keeps the cases that don't measure anything.
 */
export function positionerConformanceTests(config: PositionerTestConfig) {
  const { createComponent, defaultSide = 'bottom' } = config;
  const hasViewport = config.viewport ?? false;

  describe('Positioner conformance', () => {
    it('places the popup on the default side when it fits', async () => {
      await renderSettled(() =>
        createComponent({
          root: { open: true },
          trigger: { style: { width: '72px', height: '36px' } },
          positioner: { 'data-testid': 'positioner' },
          popup: { style: { width: '52px', height: '24px' } },
          viewport: false,
        }),
      );

      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', defaultSide);
    });

    it('applies the side and align props as data attributes', async () => {
      await renderSettled(() =>
        createComponent({
          root: { open: true },
          trigger: { style: {} },
          positioner: { 'data-testid': 'positioner', side: 'left', align: 'end' },
          popup: { style: {} },
          viewport: false,
        }),
      );

      const positioner = screen.getByTestId('positioner');
      expect(positioner).toHaveAttribute('data-side', 'left');
      expect(positioner).toHaveAttribute('data-align', 'end');
    });

    it('resolves logical sides against the direction', async () => {
      await renderSettled(() => (
        <DirectionProvider direction="rtl">
          {createComponent({
            root: { open: true },
            trigger: { style: {} },
            positioner: { 'data-testid': 'positioner', side: 'inline-start' },
            popup: { style: {} },
            viewport: false,
          })}
        </DirectionProvider>
      ));

      expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'inline-start');
    });

    // jsdom has no layout: offsets, flips, collision avoidance and the transform/top-left
    // positioning modes all measure real element rects.
    it.skip('prop: sideOffset / alignOffset (numbers, functions, callback data) (requires layout)', () => {});
    it.skip('rests exactly at collisionPadding from the colliding edge (requires layout)', () => {});
    it.skip('prop: collisionAvoidance defaults and overrides (requires layout)', () => {});
    it.skip('uses transform positioning without Viewport (requires layout)', () => {});
    if (hasViewport) {
      it.skip('uses top/left positioning with Viewport (requires layout)', () => {});
      it.skip('updates positioning when Viewport mounts and unmounts (requires layout)', () => {});
    }
    // Solid calls `render` once, so the React-only state identity check doesn't apply.
    it.skip('passes the same state object while nothing it holds changes (React-only)', () => {});
  });
}

// ---------------------------------------------------------------------------------------------
// viewportConformanceTests
// ---------------------------------------------------------------------------------------------

export interface ViewportTestTriggerProps {
  key?: string;
  id?: string;
  payload?: unknown;
  'data-testid'?: string;
  style?: JSX.CSSProperties;
  children: JSX.Element;
}

export interface ViewportTestProps {
  root?: {
    open?: boolean;
    defaultOpen?: boolean;
    defaultTriggerId?: string;
    onOpenChange?: (open: boolean, eventDetails: { preventUnmountOnClose(): void }) => void;
  };
  /**
   * The triggers. Render them with `<For each={triggers}>` (keyed by identity): an entry with a
   * new `key` is a new object, so its trigger remounts.
   */
  triggers: ViewportTestTriggerProps[];
  portal?: { keepMounted?: boolean };
  positioner?: { side?: Side; collisionAvoidance?: { side: 'none' } };
  popup?: { 'data-testid'?: string };
  viewport?: { 'data-testid'?: string };
  renderContent: (payload: unknown) => JSX.Element;
}

export interface ViewportTestConfig {
  /**
   * Returns the component tree: a Root whose children function receives the payload, one
   * Trigger per entry in `triggers` (without its `key`), and Portal > Positioner > Popup >
   * Viewport, with `renderContent(payload)` as the Viewport's children. `props` is live.
   */
  createComponent: (props: ViewportTestProps) => JSX.Element;
  /**
   * How a trigger opens the popup or switches it to that trigger.
   */
  openOn: 'click' | 'focus';
}

/**
 * Tests the morphing behavior that `createPopupViewport` gives every `*.Viewport` part.
 */
export function viewportConformanceTests(config: ViewportTestConfig) {
  const { createComponent, openOn } = config;

  async function activateTrigger(trigger: HTMLElement, user: UserEvent) {
    if (openOn === 'click') {
      await user.click(trigger);
      return;
    }

    await waitSingleFrame();
    await act(() => trigger.focus());
  }

  const renderComponent = (props: ViewportTestProps) =>
    renderSettledWithProps((p: ViewportTestProps) => createComponent(p), props);

  describe('Viewport conformance', () => {
    it('renders children in the `current` container by default', async () => {
      await renderComponent({
        root: { open: true },
        triggers: [{ children: 'Trigger' }],
        viewport: { 'data-testid': 'viewport' },
        renderContent: () => <div data-testid="content">Content</div>,
      });

      const currentContainer = screen.getByTestId('content').closest('[data-current]');
      expect(currentContainer).not.toBe(null);
      expect(currentContainer!.textContent).toBe('Content');
      expect(document.querySelector('[data-previous]')).toBe(null);

      const viewport = screen.getByTestId('viewport');
      expect(viewport).not.toHaveAttribute('data-transitioning');
      expect(viewport).not.toHaveAttribute('data-activation-direction');
    });

    it('remounts the `current` container when the active trigger changes', async () => {
      const { user } = await renderComponent({
        triggers: [
          { payload: 'first', 'data-testid': 'trigger1', children: 'Trigger 1' },
          { payload: 'second', 'data-testid': 'trigger2', children: 'Trigger 2' },
        ],
        renderContent: (payload) => (
          <>
            {payload === 'first' ? (
              <img data-testid="payload-image-1" src="about:blank" alt="Preview 1" />
            ) : null}
            {payload === 'second' ? (
              <img data-testid="payload-image-2" src="about:blank" alt="Preview 2" />
            ) : null}
          </>
        ),
      });

      await activateTrigger(screen.getByTestId('trigger1'), user);

      const firstImage = await screen.findByTestId('payload-image-1');
      const firstContainer = firstImage.closest('[data-current]');
      expect(firstContainer).not.toBe(null);

      await activateTrigger(screen.getByTestId('trigger2'), user);

      await waitFor(() => {
        expect(screen.getByTestId('payload-image-2').closest('[data-current]')).not.toBe(null);
      });
      expect(screen.getByTestId('payload-image-2').closest('[data-current]')).not.toBe(
        firstContainer,
      );
    });

    // Upstream also runs it under React's StrictMode (React-only).
    it('does not restart a transition when the active trigger remounts while closed and retained', async () => {
      const props = (triggerKey: string): ViewportTestProps => ({
        root: {
          defaultOpen: true,
          defaultTriggerId: 'trigger',
          onOpenChange: (open, eventDetails) => {
            if (!open) {
              eventDetails.preventUnmountOnClose();
            }
          },
        },
        triggers: [{ key: triggerKey, id: 'trigger', children: 'Trigger' }],
        popup: { 'data-testid': 'popup' },
        viewport: { 'data-testid': 'viewport' },
        renderContent: () => 'Content',
      });

      const { user, setProps } = await renderComponent(props('a'));

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });

      await setProps({ triggers: props('b').triggers });

      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
      expect(document.querySelector('[data-previous]')).toBe(null);
    });

    it.each([
      {
        side: 'top',
        direction: 'ltr',
        expected: { position: 'absolute', bottom: '0px', left: '0px' },
      },
      {
        side: 'top',
        direction: 'rtl',
        expected: { position: 'absolute', bottom: '0px', left: '0px' },
      },
      { side: 'bottom', direction: 'ltr', expected: {} },
      { side: 'bottom', direction: 'rtl', expected: {} },
      {
        side: 'left',
        direction: 'ltr',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
      {
        side: 'left',
        direction: 'rtl',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
      { side: 'right', direction: 'ltr', expected: {} },
      { side: 'right', direction: 'rtl', expected: {} },
      {
        side: 'inline-start',
        direction: 'ltr',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
      { side: 'inline-start', direction: 'rtl', expected: {} },
      { side: 'inline-end', direction: 'ltr', expected: {} },
      {
        side: 'inline-end',
        direction: 'rtl',
        expected: { position: 'absolute', top: '0px', right: '0px' },
      },
    ] satisfies Array<{
      side: Side;
      direction: 'ltr' | 'rtl';
      expected: { position?: string; top?: string; right?: string; bottom?: string; left?: string };
    }>)('anchors the popup for side=$side in $direction mode', async ({ side, direction, expected }) => {
      await renderSettled(() => (
        <DirectionProvider direction={direction}>
          {createComponent({
            root: { open: true },
            triggers: [{ children: 'Trigger' }],
            positioner: { side, collisionAvoidance: { side: 'none' } },
            popup: { 'data-testid': 'popup' },
            renderContent: () => 'Content',
          })}
        </DirectionProvider>
      ));

      const expectedStyle = expected as {
        position?: string;
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
      };
      const { style } = screen.getByTestId('popup');
      expect(style.position).toBe(expectedStyle.position ?? '');
      expect(style.top).toBe(expectedStyle.top ?? '');
      expect(style.right).toBe(expectedStyle.right ?? '');
      expect(style.bottom).toBe(expectedStyle.bottom ?? '');
      expect(style.left).toBe(expectedStyle.left ?? '');
    });

    // jsdom has no layout or CSS animations: the morphing containers (previous snapshot,
    // activation direction, cleanup after animations) are browser-only upstream.
    it.skip('morphing containers (requires layout and animations)', () => {});
  });
}
