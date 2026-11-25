import { For, Show, createSignal, flush, omit, onCleanup, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { Dialog } from '.';
import type { AlertDialog } from '../alert-dialog';
import { REASONS } from '../internals/reasons';
import type { InteractionType } from '../utils/popups/interactions/enhancedClickHandler';
import { useDialogRootContext } from './root/DialogRootContext';

// ---------------------------------------------------------------------------------------------
// Generic helpers (Solid replacements of `@mui/internal-test-utils`)
// ---------------------------------------------------------------------------------------------

/**
 * Renders `ui` and returns a `user-event` instance along with the render result.
 */
export function renderWithUser(
  ui: () => JSX.Element,
  options?: Parameters<typeof render>[1],
): ReturnType<typeof render> & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const result = render(ui, options);
  return { ...result, user };
}

/**
 * Lets pending microtasks run and flushes Solid's queued updates.
 */
export async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
  flush();
}

/**
 * Runs `fn`, then flushes Solid's queued updates and pending microtasks (upstream's `act`).
 */
export async function act(fn: () => unknown) {
  await fn();
  flush();
  await flushMicrotasks();
}

export function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function waitSingleFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function createRef<T>(): RefObject<T | null> {
  return { current: null };
}

/**
 * Renders `createComponent(props)` and returns a `setProps` that merges new props in, like
 * upstream's `setProps`/`rerender`. Props are exposed through getters, so the component sees the
 * latest values.
 */
export function renderWithProps<P extends object>(
  createComponent: (props: P) => JSX.Element,
  initialProps: P,
  options?: Parameters<typeof render>[1],
) {
  const [state, setState] = createSignal<{ value: P }>({ value: initialProps });
  const props = () => state().value;
  const keys = new Set<string>(Object.keys(initialProps));
  const live = new Proxy({} as P, {
    get: (_target, key) => (props() as any)[key],
    has: (_target, key) => key in (props() as any),
    ownKeys: () => Array.from(new Set([...keys, ...Object.keys(props() as any)])),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  });
  const result = renderWithUser(() => createComponent(live), options);
  return {
    ...result,
    async setProps(next: Partial<P>) {
      Object.keys(next).forEach((key) => keys.add(key));
      setState((previous) => ({ value: { ...previous.value, ...next } }));
      flush();
      await flushMicrotasks();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Dialog fixtures (upstream `ContainedTriggerDialog`, `DetachedTriggerDialog`,
// `MultipleDetachedTriggersDialog`)
// ---------------------------------------------------------------------------------------------

export type TestDialogProps = {
  rootProps?: Omit<Dialog.Root.Props, 'children'>;
  triggerProps?: Dialog.Trigger.Props;
  portalProps?: Dialog.Portal.Props;
  /**
   * `children` should be a getter, so they are created inside the Root.
   */
  popupProps?: Dialog.Popup.Props & Record<string, any>;
  omitTrigger?: boolean;
  includeBackdrop?: boolean;
  triggerWrapper?: (trigger: () => JSX.Element) => JSX.Element;
};

function renderTrigger(props: TestDialogProps, extra?: Record<string, any>) {
  const triggerProps = () => props.triggerProps ?? {};
  const create = () => (
    <Dialog.Trigger data-testid="trigger" {...omit(triggerProps(), 'children')} {...extra}>
      {triggerProps().children ?? 'Open'}
    </Dialog.Trigger>
  );
  return props.triggerWrapper ? props.triggerWrapper(create) : create();
}

export function ContainedTriggerDialog(props: TestDialogProps) {
  const popupProps = () => props.popupProps ?? {};
  const portalProps = () => props.portalProps ?? {};
  return (
    <Dialog.Root {...props.rootProps}>
      <Show when={!props.omitTrigger}>{renderTrigger(props)}</Show>
      <Dialog.Portal {...omit(portalProps(), 'children')}>
        {portalProps().children ?? (
          <>
            <Show when={props.includeBackdrop}>
              <Dialog.Backdrop
                data-testid="backdrop"
                style={{ position: 'fixed', 'z-index': '10', inset: '0' }}
              />
            </Show>
            <Dialog.Popup
              data-testid="dialog-popup"
              style={{ position: 'fixed', 'z-index': '10' }}
              {...omit(popupProps(), 'children')}
            >
              {popupProps().children ?? (
                <>
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </>
              )}
            </Dialog.Popup>
          </>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DetachedTriggerDialog(props: Omit<TestDialogProps, 'omitTrigger'>) {
  const handle = Dialog.createHandle();
  return (
    <>
      {renderTrigger(props, { handle })}
      <ContainedTriggerDialog
        {...props}
        rootProps={{ ...props.rootProps, handle } as TestDialogProps['rootProps']}
        omitTrigger
      />
    </>
  );
}

export function MultipleDetachedTriggersDialog(props: Omit<TestDialogProps, 'omitTrigger'>) {
  const handle = Dialog.createHandle();
  return (
    <>
      {renderTrigger(props, { handle })}
      <Dialog.Trigger data-testid="trigger-2" handle={handle}>
        Open another
      </Dialog.Trigger>
      <ContainedTriggerDialog
        {...props}
        rootProps={{ ...props.rootProps, handle } as TestDialogProps['rootProps']}
        omitTrigger
      />
    </>
  );
}

/**
 * Reports the Root's internal `openchange` events.
 */
export function DialogOpenChangeSpy(props: {
  onOpenChange: (details: { open: boolean; reason: string | null | undefined }) => void;
}) {
  const store = useDialogRootContext();
  const handleOpenChange = (details: { open: boolean; reason: string | null | undefined }) => {
    props.onOpenChange(details);
  };
  store.context.events.on('openchange', handleOpenChange);
  onCleanup(() => store.context.events.off('openchange', handleOpenChange));
  return null;
}

// ---------------------------------------------------------------------------------------------
// popupConformanceTests (click-triggered popups)
// ---------------------------------------------------------------------------------------------

interface OpenChangeEventDetails {
  reason: string;
  cancel: () => void;
  preventUnmountOnClose: () => void;
}

export interface ConformanceRootProps {
  actionsRef?: RefObject<{ close: () => void; unmount: () => void } | null>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, eventDetails: OpenChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
}

export interface TestedComponentProps {
  root?: ConformanceRootProps;
  popup?: { class?: string; id?: string; 'data-testid'?: string };
  trigger?: { 'data-testid'?: string };
  portal?: { keepMounted?: boolean };
}

export interface PopupTestConfig {
  /**
   * Returns the tree to test. `props` is live: spread its fields on the parts.
   */
  createComponent: (props: TestedComponentProps) => JSX.Element;
  expectedPopupRole: string;
  expectedAriaHasPopupValue?: string;
}

function getConformanceTrigger() {
  return screen.getByTestId('trigger');
}

function getConformancePopup() {
  return screen.queryByTestId('popup');
}

export function popupConformanceTests(config: PopupTestConfig) {
  const { createComponent, expectedPopupRole } = config;
  const expectedAriaHasPopupValue = config.expectedAriaHasPopupValue ?? expectedPopupRole;
  const openReason = REASONS.triggerPress;

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

  const expectPopupClosed = () => {
    expect(getConformancePopup()).toBe(null);
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
          // Resolved by the test once every close was requested, so the closes always arrive
          // during the wait regardless of how long the key presses take.
          let finishWait!: () => void;
          const waitForCloses = new Promise<void>((resolve) => {
            finishWait = resolve;
          });

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
                  await waitForCloses;
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
          finishWait();
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
}

// ---------------------------------------------------------------------------------------------
// dialogRootSharedTests
// ---------------------------------------------------------------------------------------------

export interface DialogRootSharedTestsConfig {
  parts: typeof Dialog | typeof AlertDialog;
  popupRole: 'dialog' | 'alertdialog';
}

/**
 * Root behavior that Dialog and AlertDialog share.
 */
export function dialogRootSharedTests(config: DialogRootSharedTestsConfig) {
  const { parts, popupRole } = config;
  const { Root, Trigger, Portal, Popup, Close, createHandle } = parts as typeof Dialog;

  const queryPopup = () => screen.queryByRole(popupRole);

  describe('Dialog root shared behavior', () => {
    describe('prop: onOpenChange', () => {
      it('reports the trigger and reason when opened by a trigger and closed by a close button', async () => {
        const handleOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <Root onOpenChange={handleOpenChange}>
            <Trigger>Open</Trigger>
            <Portal>
              <Popup>
                <Close>Close</Close>
              </Popup>
            </Portal>
          </Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);

        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          true,
          expect.objectContaining({ reason: REASONS.triggerPress, trigger }),
        );

        await user.click(screen.getByRole('button', { name: 'Close' }));

        expect(handleOpenChange).toHaveBeenCalledTimes(2);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          2,
          false,
          expect.objectContaining({ reason: REASONS.closePress, trigger }),
        );
      });

      it('reports the trigger the popup was opened from for an Escape close', async () => {
        const handleOpenChange = vi.fn();

        const { user } = renderWithUser(() => (
          <Root onOpenChange={handleOpenChange}>
            <Trigger>Open A</Trigger>
            <Trigger>Open B</Trigger>
            <Portal>
              <Popup />
            </Portal>
          </Root>
        ));

        const triggerB = screen.getByRole('button', { name: 'Open B' });
        await user.click(triggerB);
        expect(queryPopup()).not.toBe(null);
        await user.keyboard('[Escape]');

        expect(handleOpenChange).toHaveBeenCalledTimes(2);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          2,
          false,
          expect.objectContaining({ reason: REASONS.escapeKey, trigger: triggerB }),
        );
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the popup when the `unmount` method is called', async () => {
        const actionsRef = createRef<Dialog.Root.Actions>();

        const { user } = renderWithUser(() => (
          <Root
            actionsRef={actionsRef}
            onOpenChange={(open, details) => {
              if (!open) {
                details.preventUnmountOnClose();
              }
            }}
          >
            <Trigger>Open</Trigger>
            <Portal>
              <Popup />
            </Portal>
          </Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);
        expect(await screen.findByRole(popupRole)).toBeVisible();

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });
        expect(screen.getByRole(popupRole, { hidden: true })).toHaveAttribute('data-closed');

        await act(() => actionsRef.current?.unmount());

        await waitFor(() => {
          expect(screen.queryByRole(popupRole, { hidden: true })).toBe(null);
        });
      });

      it('clears manual unmount state after the `unmount` method is called', async () => {
        const actionsRef = createRef<Dialog.Root.Actions>();
        let shouldPreventUnmount = true;

        const { user } = renderWithUser(() => (
          <Root
            actionsRef={actionsRef}
            onOpenChange={(open, details) => {
              if (!open && shouldPreventUnmount) {
                shouldPreventUnmount = false;
                details.preventUnmountOnClose();
              }
            }}
          >
            <Trigger>Open</Trigger>
            <Portal>
              <Popup>
                <Close>Close</Close>
              </Popup>
            </Portal>
          </Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);
        expect(await screen.findByRole(popupRole)).toBeVisible();

        await user.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });
        expect(screen.getByRole(popupRole, { hidden: true })).toHaveAttribute('data-closed');

        await act(() => actionsRef.current?.unmount());
        await waitFor(() => {
          expect(screen.queryByRole(popupRole, { hidden: true })).toBe(null);
        });

        // The next close unmounts on its own again.
        await user.click(trigger);
        expect(await screen.findByRole(popupRole)).toBeVisible();

        await user.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => {
          expect(screen.queryByRole(popupRole, { hidden: true })).toBe(null);
        });
      });

      it('closes the popup when the `close` method is called', async () => {
        const actionsRef = createRef<Dialog.Root.Actions>();
        const handleOpenChange = vi.fn();

        render(() => (
          <Root defaultOpen actionsRef={actionsRef} onOpenChange={handleOpenChange}>
            <Portal>
              <Popup />
            </Portal>
          </Root>
        ));

        expect(screen.getByRole(popupRole)).toBeVisible();

        await act(() => actionsRef.current?.close());

        await waitFor(() => {
          expect(queryPopup()).toBe(null);
        });
        expect(handleOpenChange).toHaveBeenCalledTimes(1);
        expect(handleOpenChange).toHaveBeenNthCalledWith(
          1,
          false,
          expect.objectContaining({ reason: REASONS.imperativeAction }),
        );
      });
    });

    describe('imperative actions on the handle', () => {
      it('opens with a payload set programmatically', async () => {
        const handle = createHandle<number>();
        render(() => (
          <div>
            <Trigger handle={handle} id="trigger-1" payload={1}>
              Trigger 1
            </Trigger>
            <Trigger handle={handle} id="trigger-2" payload={2}>
              Trigger 2
            </Trigger>
            <Root handle={handle}>
              {(arg: { readonly payload: number | undefined }) => (
                <Portal>
                  <Popup data-testid="content">{arg.payload}</Popup>
                </Portal>
              )}
            </Root>
          </div>
        ));

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
        expect(queryPopup()).toBe(null);

        await act(() => handle.openWithPayload(8));
        await waitFor(() => {
          expect(queryPopup()).not.toBe(null);
        });

        expect(screen.getByTestId('content')).toHaveTextContent('8');
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(trigger2).toHaveAttribute('aria-expanded', 'false');

        await act(() => handle.close());
        await waitFor(() => {
          expect(queryPopup()).toBe(null);
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// popupFocusPropsTests
// ---------------------------------------------------------------------------------------------

interface FocusTargets {
  /** An input rendered after the popup, outside of it. */
  outside: RefObject<HTMLInputElement | null>;
  /** The second of two inputs rendered inside the popup. */
  inside: RefObject<HTMLInputElement | null>;
}

type FocusPropValue =
  | boolean
  | RefObject<HTMLElement | null>
  | HTMLElement
  | ((interactionType: InteractionType) => boolean | HTMLElement | null | void)
  | undefined;

type PopupFocusPropFactory = boolean | undefined | ((targets: FocusTargets) => FocusPropValue);

interface PopupFocusProps {
  initialFocus?: PopupFocusPropFactory;
  finalFocus?: PopupFocusPropFactory;
}

export interface PopupFocusPropsTestsConfig {
  /**
   * Returns the popup tree. It must render a trigger labeled "Open", spread `initialFocus` and
   * `finalFocus` on the popup, and render `children()` followed by a "Close" control.
   */
  createComponent: (props: {
    initialFocus: FocusPropValue;
    finalFocus: FocusPropValue;
    children: () => JSX.Element;
  }) => JSX.Element;
}

/**
 * Value resolution of the `initialFocus` and `finalFocus` popup props.
 */
export function popupFocusPropsTests(config: PopupFocusPropsTestsConfig) {
  const { createComponent } = config;

  function Test(props: { popupProps?: PopupFocusProps; withPopupInputs?: boolean }) {
    const outside: RefObject<HTMLInputElement | null> = { current: null };
    const inside: RefObject<HTMLInputElement | null> = { current: null };
    const targets: FocusTargets = { outside, inside };
    const resolve = (value: PopupFocusPropFactory) =>
      typeof value === 'function' ? value(targets) : value;
    const popupProps = props.popupProps ?? {};

    return (
      <div>
        <input data-testid="outside-before" />
        {createComponent({
          initialFocus: resolve(popupProps.initialFocus),
          finalFocus: resolve(popupProps.finalFocus),
          children: () =>
            props.withPopupInputs ? (
              <>
                <input data-testid="inside-1" />
                <input
                  data-testid="inside-2"
                  ref={(el) => {
                    inside.current = el;
                  }}
                />
              </>
            ) : null,
        })}
        <input
          data-testid="outside-target"
          ref={(el) => {
            outside.current = el;
          }}
        />
      </div>
    );
  }

  const getTrigger = () => screen.getByRole('button', { name: 'Open' });

  function expectClosed() {
    expect(screen.queryByText('Close')).toBe(null);
  }

  async function closeWithPointer(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByText('Close'));
  }

  describe('prop: initialFocus', () => {
    it('focuses the first focusable element by default', async () => {
      const { user } = renderWithUser(() => <Test withPopupInputs />);

      await user.click(getTrigger());
      await waitFor(() => {
        expect(screen.getByTestId('inside-1')).toHaveFocus();
      });
    });

    it('focuses the element of a ref', async () => {
      const { user } = renderWithUser(() => (
        <Test withPopupInputs popupProps={{ initialFocus: ({ inside }) => inside }} />
      ));

      await user.click(getTrigger());
      await waitFor(() => {
        expect(screen.getByTestId('inside-2')).toHaveFocus();
      });
    });

    it.each([
      {
        name: 'an element',
        returns: ({ inside }: FocusTargets) => inside.current,
        focused: 'inside-2',
      },
      // `true` and `null` keep the default target, so the spy proves the function was consulted.
      { name: 'true', returns: () => true, focused: 'inside-1' },
      { name: 'null', returns: () => null, focused: 'inside-1' },
    ])('focuses the right element when a function returns $name', async ({ returns, focused }) => {
      const initialFocusSpy = vi.fn();
      const { user } = renderWithUser(() => (
        <Test
          withPopupInputs
          popupProps={{
            initialFocus: (targets) => (openType: InteractionType) => {
              initialFocusSpy(openType);
              return returns(targets);
            },
          }}
        />
      ));

      await user.click(getTrigger());
      await waitFor(() => {
        expect(screen.getByTestId(focused)).toHaveFocus();
      });
      expect(initialFocusSpy).toHaveBeenCalledTimes(1);
    });

    it('does not move focus when `false`', async () => {
      const { user } = renderWithUser(() => (
        <Test withPopupInputs popupProps={{ initialFocus: false }} />
      ));

      const trigger = getTrigger();
      await user.click(trigger);
      await screen.findByText('Close');
      await act(() => waitSingleFrame());

      expect(trigger).toHaveFocus();
    });

    it('passes the interaction type to a function, and does nothing when it returns undefined', async () => {
      const initialFocusSpy = vi.fn();

      const { user } = renderWithUser(() => (
        <Test
          withPopupInputs
          popupProps={{
            initialFocus:
              ({ inside }) =>
              (openType: InteractionType) => {
                initialFocusSpy(openType);
                return openType === 'keyboard' ? inside.current : undefined;
              },
          }}
        />
      ));

      const trigger = getTrigger();

      await user.click(trigger);
      await waitFor(() => {
        expect(initialFocusSpy).toHaveBeenLastCalledWith('mouse');
      });
      expect(trigger).toHaveFocus();

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expectClosed();
      });

      await act(() => trigger.focus());
      await user.keyboard('[Enter]');
      await waitFor(() => {
        expect(screen.getByTestId('inside-2')).toHaveFocus();
      });
      expect(initialFocusSpy).toHaveBeenLastCalledWith('keyboard');

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expectClosed();
      });

      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger, { detail: 1 });
      await waitFor(() => {
        expect(initialFocusSpy).toHaveBeenLastCalledWith('touch');
      });
      expect(initialFocusSpy).toHaveBeenCalledTimes(3);
    });

    it('is not called again when the popup closes', async () => {
      const initialFocusSpy = vi.fn();

      const { user } = renderWithUser(() => (
        <Test
          withPopupInputs
          popupProps={{
            initialFocus:
              ({ inside }) =>
              () => {
                initialFocusSpy();
                return inside.current;
              },
          }}
        />
      ));

      await user.click(getTrigger());
      await waitFor(() => {
        expect(screen.getByTestId('inside-2')).toHaveFocus();
      });
      expect(initialFocusSpy).toHaveBeenCalledTimes(1);

      await closeWithPointer(user);
      await waitFor(() => {
        expect(getTrigger()).toHaveFocus();
      });
      expect(initialFocusSpy).toHaveBeenCalledTimes(1);
    });
  });

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
      const { user } = renderWithUser(() => (
        <Test popupProps={{ finalFocus: ({ outside }) => outside }} />
      ));

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
      { name: 'true', returns: () => true, getFocused: getTrigger },
      { name: 'null', returns: () => null, getFocused: getTrigger },
    ])('focuses the right element when a function returns $name', async ({ returns, getFocused }) => {
      const finalFocusSpy = vi.fn();
      const { user } = renderWithUser(() => (
        <Test
          popupProps={{
            finalFocus: (targets) => (closeType: InteractionType) => {
              finalFocusSpy(closeType);
              return returns(targets);
            },
          }}
        />
      ));

      await user.click(getTrigger());
      await closeWithPointer(user);

      await waitFor(() => {
        expect(getFocused()).toHaveFocus();
      });
      expect(finalFocusSpy).toHaveBeenCalledTimes(1);
    });

    it('does not move focus when `false`', async () => {
      const { user } = renderWithUser(() => <Test popupProps={{ finalFocus: false }} />);

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
          popupProps={{
            finalFocus:
              ({ outside }) =>
              (closeType: InteractionType) => {
                finalFocusSpy(closeType);
                return closeType === 'keyboard' ? outside.current : true;
              },
          }}
        />
      ));

      const trigger = getTrigger();

      await user.click(trigger);
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
}


// ---------------------------------------------------------------------------------------------
// detachedTriggersConformanceTests (Dialog-like popups: click to open, `Close` part, no positioner)
// ---------------------------------------------------------------------------------------------

export interface DetachedTriggersTestHandle {
  open(triggerId: string | null): void;
  close(): void;
  readonly isOpen: boolean;
}

type AnyComponent = (props: any) => JSX.Element;

export interface DetachedTriggersTestConfig {
  createHandle: () => DetachedTriggersTestHandle;
  Root: AnyComponent;
  Trigger: AnyComponent;
  Portal: AnyComponent;
  Popup: AnyComponent;
  Close: AnyComponent;
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
}

/**
 * Behavior shared by every popup that supports multiple triggers and detached triggers
 * (`handle` + `createHandle()`), for click-opened popups with a `Close` part.
 */
export function detachedTriggersConformanceTests(config: DetachedTriggersTestConfig) {
  const { createHandle, Root, Trigger, Portal, Popup, Close } = config;

  function Fixture(props: FixtureProps) {
    const detached = () => props.mode === 'detached';
    const handle = () => (detached() ? props.handle : undefined);

    const triggers = () => (
      <For each={Array.from({ length: props.triggerCount ?? 2 }, (_, index) => index + 1)}>
        {(number) => (
          <Trigger
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

    const wrappedTriggers = () => {
      let result: () => JSX.Element = triggers;
      for (let level = 0; level < (props.nesting ?? 0); level += 1) {
        const inner = result;
        result = () => <div>{inner()}</div>;
      }
      return result();
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
              <Portal>
                <Popup data-testid="popup">
                  <span data-testid="content">{String(arg.payload)}</span>
                  <Close>Close popup</Close>
                </Popup>
              </Portal>
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

      expect(trigger).toHaveAttribute('aria-expanded', String(active));
      if (active) {
        expect(popupId).not.toBe('');
        expect(trigger).toHaveAttribute('aria-controls', popupId);
      } else if (popupId !== null) {
        expect(trigger).not.toHaveAttribute('aria-controls');
      }
    }
  }

  function countWarnings(consoleWarn: { mock: { calls: unknown[][] } }, text: string) {
    return consoleWarn.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes(text),
    ).length;
  }

  const renderFixture = (props: FixtureProps) =>
    renderWithProps((p: FixtureProps) => <Fixture {...p} />, props);

  describe('detached triggers conformance', () => {
    describe.each([{ mode: 'contained' as const }, { mode: 'detached' as const }])(
      '$mode triggers',
      ({ mode }) => {
        // In `contained` mode the handle is never passed to the parts.
        const getHandle = () => (mode === 'detached' ? createHandle() : undefined);

        describe('multiple triggers', () => {
          it('opens with any trigger on click and marks only that trigger as active', async () => {
            const { user } = renderFixture({ mode, handle: getHandle(), triggerCount: 3 });

            expect(screen.queryByTestId('popup')).toBe(null);
            expectActiveTrigger(null, 3);

            for (const number of [1, 2, 3]) {
              const trigger = getTrigger(number);

              // eslint-disable-next-line no-await-in-loop
              await user.click(trigger);
              // eslint-disable-next-line no-await-in-loop
              await waitForPopupOpen();
              expectActiveTrigger(number, 3);

              // eslint-disable-next-line no-await-in-loop
              await user.click(screen.getByText('Close popup'));
              // eslint-disable-next-line no-await-in-loop
              await waitForPopupClosed();
              expectActiveTrigger(null, 3);
            }
          });

          it('sets the payload of the active trigger and renders content based on it', async () => {
            const { user } = renderFixture({ mode, handle: getHandle() });

            await user.click(getTrigger(1));
            await waitForContent('1');
            expect(screen.getByTestId('root-payload').textContent).toBe('1');

            await user.click(getTrigger(2));
            await waitForContent('2');
            expect(screen.getByTestId('root-payload').textContent).toBe('2');
            expectActiveTrigger(2);
          });

          it('reports the trigger the popup was opened from for an Escape close', async () => {
            const onOpenChange = vi.fn();
            const { user } = renderFixture({ mode, handle: getHandle(), rootProps: { onOpenChange } });

            await user.click(getTrigger(2));
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
            const { user, setProps } = renderFixture({
              mode,
              handle: getHandle(),
              rootProps: { onOpenChange },
            });

            await user.click(getTrigger(2));
            await waitForPopupOpen();
            await setProps({ triggerCount: 1 });
            await user.keyboard('[Escape]');
            await waitForPopupClosed();

            expect(onOpenChange).toHaveBeenLastCalledWith(
              false,
              expect.objectContaining({ trigger: undefined }),
            );
          });

          it('reuses the popup DOM nodes when switching triggers', async () => {
            const { user } = renderFixture({ mode, handle: getHandle() });

            await user.click(getTrigger(1));
            await waitForContent('1');
            const popupElement = screen.getByTestId('popup');

            await user.click(getTrigger(2));
            await waitForContent('2');
            expect(screen.getByTestId('popup')).toBe(popupElement);
          });

          it('marks the trigger matching a controlled `triggerId` as active', async () => {
            renderFixture({
              mode,
              handle: getHandle(),
              rootProps: { open: true, triggerId: 'trigger-2' },
            });

            await waitForPopupOpen();
            expect(screen.getByTestId('content').textContent).toBe('2');
            expectActiveTrigger(2);
          });

          it('opens initially with the payload of a non-first `defaultTriggerId`', async () => {
            renderFixture({
              mode,
              handle: getHandle(),
              triggerCount: 3,
              rootProps: { defaultOpen: true, defaultTriggerId: 'trigger-2' },
            });

            await waitForContent('2');
            expectActiveTrigger(2, 3);
          });

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
                </div>
              );
            }

            const { user } = renderWithUser(() => <Controlled />);

            // Queried up front: a modal popup hides the rest of the page from the accessibility tree.
            const openTrigger1 = screen.getByRole('button', { name: 'Open Trigger 1' });
            const openTrigger2 = screen.getByRole('button', { name: 'Open Trigger 2' });

            await user.click(openTrigger1);
            await waitForContent('1');
            expectActiveTrigger(1);

            await user.click(openTrigger2);
            await waitForContent('2');
            expectActiveTrigger(2);

            await user.click(screen.getByText('Close popup'));
            await waitForPopupClosed();
            // Focus returns to the element that opened the popup.
            await waitFor(() => {
              expect(openTrigger2).toHaveFocus();
            });
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
                />
              );
            }

            const { user } = renderWithUser(() => <Controlled />);

            await user.click(getTrigger(1));
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
        });
      },
    );

    describe('detached triggers', () => {
      describe('imperative actions on the handle', () => {
        it('opens by trigger id with its payload and closes', async () => {
          const handle = createHandle();
          renderFixture({ mode: 'detached', handle });

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

        it('opens unassociated with a warning when opened with an unregistered trigger id', async () => {
          const handle = createHandle();
          renderFixture({ mode: 'detached', handle });

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

            const { setProps } = renderFixture({ mode: 'detached', handle, rootMounted: true });
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

        it('registers a detached trigger declared after the root', async () => {
          const { user } = renderFixture({ mode: 'detached', handle: createHandle(), rootFirst: true });

          await user.click(getTrigger(2));
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
            return (
              <Root handle={handle}>
                <Portal>
                  <Popup>{key}</Popup>
                </Portal>
              </Root>
            );
          }

          function App(props: { phase: 'outgoing' | 'overlap' | 'incoming' }) {
            return (
              <>
                <For each={[1, 2]}>
                  {(number) => (
                    <Trigger handle={handle} id={`trigger-${number}`} data-testid={`trigger-${number}`}>
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
            const { setProps } = renderWithProps(
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
        async function expectOpensAndCloses(user: ReturnType<typeof userEvent.setup>) {
          await user.click(getTrigger(1));
          await waitForPopupOpen();
          expectActiveTrigger(1, 1);
          await user.click(screen.getByText('Close popup'));
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
          const { user, setProps } = renderFixture({
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
