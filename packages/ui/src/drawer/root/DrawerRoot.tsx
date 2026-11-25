import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { NOOP } from '@egoist/solid-base-utils/empty';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import { platform } from '@egoist/solid-base-utils/platform';
import { DrawerRootContext, useDrawerRootContext } from './DrawerRootContext';
import type {
  DrawerNestedSwipeProgressStore,
  DrawerSwipeDirection,
  DrawerSnapPoint,
} from './DrawerRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { renderDialogRoot } from '../../dialog/root/useRenderDialogRoot';
import type { DialogRootProps } from '../../dialog/root/DialogRoot';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerHandle } from '../handle';
import type { ActionsRef, PayloadChildRenderFunction } from '../../utils/popups/popupRoot';

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerRoot<Payload = unknown>(props: DrawerRoot.Props<Payload>): JSX.Element {
  const parentDrawerRootContext = useDrawerRootContext(true);

  const [popupHeight, setPopupHeight] = createSignal(0, { ownedWrite: true });
  const [frontmostHeight, setFrontmostHeight] = createSignal(0, { ownedWrite: true });
  const [hasNestedDrawer, setHasNestedDrawer] = createSignal(false, { ownedWrite: true });
  const [nestedSwiping, setNestedSwiping] = createSignal(false, { ownedWrite: true });
  const nestedSwipeProgressStore = createNestedSwipeProgressStore();

  // Plain mirrors: reads of the signals lag their writes.
  let popupHeightValue = 0;
  let isNestedDrawerOpen = false;

  const resolvedDefaultSnapPoint = () =>
    props.defaultSnapPoint !== undefined ? props.defaultSnapPoint : (props.snapPoints?.[0] ?? null);

  const [activeSnapPoint, setActiveSnapPointUnwrapped] = createControllableSignal<
    DrawerSnapPoint | null
  >({
    value: () => props.snapPoint,
    defaultValue: resolvedDefaultSnapPoint,
  });

  const setActiveSnapPoint = (
    nextSnapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRoot.SnapPointChangeEventDetails,
  ) => {
    const resolvedEventDetails =
      eventDetails ??
      (createChangeEventDetails(REASONS.none) as DrawerRoot.SnapPointChangeEventDetails);

    props.onSnapPointChange?.(nextSnapPoint, resolvedEventDetails);

    if (resolvedEventDetails.isCanceled) {
      return;
    }

    setActiveSnapPointUnwrapped(nextSnapPoint);
  };

  const resolvedActiveSnapPoint = createMemo(() => {
    const current = activeSnapPoint() ?? null;
    if (props.snapPoint !== undefined) {
      return current;
    }

    const snapPoints = props.snapPoints;
    if (!snapPoints || snapPoints.length === 0) {
      return current;
    }

    if (current === null || !snapPoints.some((snapPoint) => Object.is(snapPoint, current))) {
      return resolvedDefaultSnapPoint();
    }

    return current;
  });

  const notifyParentSwipeProgressChange = parentDrawerRootContext?.onNestedSwipeProgressChange;
  const notifyParentSwipingChange = parentDrawerRootContext?.onNestedSwipingChange;

  const handleOpenChange = (nextOpen: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => {
    props.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    const snapPoints = props.snapPoints;
    if (!nextOpen && snapPoints && snapPoints.length > 0) {
      setActiveSnapPoint(
        resolvedDefaultSnapPoint(),
        createChangeEventDetails(
          eventDetails.reason,
          eventDetails.event,
          eventDetails.trigger as HTMLElement | undefined,
        ) as DrawerRoot.SnapPointChangeEventDetails,
      );
    }
  };

  const contextValue: DrawerRootContext = {
    get swipeDirection() {
      return props.swipeDirection ?? 'down';
    },
    swipeAreaActiveRef: { current: false },
    get snapToSequentialPoints() {
      return props.snapToSequentialPoints ?? false;
    },
    get snapPoints() {
      return props.snapPoints;
    },
    get activeSnapPoint() {
      return resolvedActiveSnapPoint();
    },
    setActiveSnapPoint,
    get frontmostHeight() {
      return frontmostHeight();
    },
    get popupHeight() {
      return popupHeight();
    },
    get hasNestedDrawer() {
      return hasNestedDrawer();
    },
    get nestedSwiping() {
      return nestedSwiping();
    },
    nestedSwipeProgressStore,
    onNestedDrawerPresenceChange(present) {
      setHasNestedDrawer(present);
    },
    onPopupHeightChange(height) {
      popupHeightValue = height;
      setPopupHeight(height);

      if (!isNestedDrawerOpen && height > 0) {
        setFrontmostHeight(height);
      }
    },
    onNestedFrontmostHeightChange(height) {
      if (height > 0) {
        isNestedDrawerOpen = true;
        setFrontmostHeight(height);
        return;
      }

      isNestedDrawerOpen = false;
      if (popupHeightValue > 0) {
        setFrontmostHeight(popupHeightValue);
      }
    },
    onNestedSwipingChange(swiping) {
      setNestedSwiping(swiping);
      notifyParentSwipingChange?.(swiping);
    },
    onNestedSwipeProgressChange(progress) {
      nestedSwipeProgressStore.set(progress);
      notifyParentSwipeProgressChange?.(progress);
    },
    notifyParentFrontmostHeight: parentDrawerRootContext?.onNestedFrontmostHeightChange,
    notifyParentSwipingChange,
    notifyParentSwipeProgressChange,
    notifyParentHasNestedDrawer: parentDrawerRootContext?.onNestedDrawerPresenceChange,
  };

  const dialogProps: DialogRootProps<Payload> = {
    get open() {
      return props.open;
    },
    get defaultOpen() {
      return props.defaultOpen;
    },
    onOpenChange: handleOpenChange as DialogRootProps<Payload>['onOpenChange'],
    get onOpenChangeComplete() {
      return props.onOpenChangeComplete;
    },
    get disablePointerDismissal() {
      return props.disablePointerDismissal;
    },
    get modal() {
      return props.modal;
    },
    get actionsRef() {
      return props.actionsRef;
    },
    get handle() {
      return props.handle;
    },
    get triggerId() {
      return props.triggerId;
    },
    get defaultTriggerId() {
      return props.defaultTriggerId;
    },
    // Read once, by the dialog root.
    get children() {
      const children = props.children;
      if (typeof children === 'function' && children.length > 0) {
        return ((arg: Parameters<PayloadChildRenderFunction<Payload>>[0]) => [
          <DrawerProviderReporter />,
          (children as PayloadChildRenderFunction<Payload>)(arg),
        ]) as unknown as JSX.Element;
      }
      return [<DrawerProviderReporter />, children as JSX.Element];
    },
  };

  // A component, so the dialog root renders inside the drawer context and untracked.
  const DrawerDialogRoot = () => renderDialogRoot('drawer', dialogProps);

  return (
    <DrawerRootContext value={contextValue}>
      <DrawerDialogRoot />
    </DrawerRootContext>
  );
}

export interface DrawerRootState {}

export interface DrawerRootProps<Payload = unknown> {
  /**
   * Whether the drawer is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the drawer is initially open.
   *
   * To render a controlled drawer, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the drawer enters a modal state when open.
   * - `true`: user interaction is limited to just the drawer: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the drawer, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Event handler called when the drawer is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the drawer is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the drawer from closing on outside presses.
   * For non-modal drawers, this also prevents the drawer from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A ref to imperative actions: a ref object (`{ current: null }`) or a callback receiving them (and `null` on unmount).
   * - `unmount`: Ends the closing phase of the drawer after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the drawer completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the drawer imperatively when called.
   */
  actionsRef?: ActionsRef<DrawerRoot.Actions> | undefined;
  /**
   * A handle to associate the drawer with a trigger.
   * If specified, allows detached triggers to control the drawer's open state.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled drawer.
   * There's no need to specify this prop when the drawer is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open drawer.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * The content of the drawer.
   * This can be regular elements or a function that receives the `payload` of the active trigger
   * (called once; `payload` is a live getter).
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * The swipe direction used to dismiss the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * Snap points used to position the drawer.
   * Use numbers between 0 and 1 to represent fractions of the viewport height,
   * numbers greater than 1 as pixel values, or strings in `px`/`rem` units
   * (for example, `'148px'` or `'30rem'`).
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /**
   * Disables velocity-based snap skipping so drag distance determines the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
  /**
   * The currently active snap point. Use with `onSnapPointChange` to control the snap point.
   */
  snapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * The initial snap point value when uncontrolled.
   */
  defaultSnapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * Callback fired when the snap point changes.
   */
  onSnapPointChange?:
    | ((
        snapPoint: DrawerSnapPoint | null,
        eventDetails: DrawerRoot.SnapPointChangeEventDetails,
      ) => void)
    | undefined;
}

export interface DrawerRootActions {
  unmount: () => void;
  close: () => void;
}

export type DrawerRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closeWatcher
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.swipe
  | typeof REASONS.none;

export type DrawerRootChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export type DrawerRootSnapPointChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRootSnapPointChangeEventReason>;

export namespace DrawerRoot {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

interface NestedSwipeProgressStore extends DrawerNestedSwipeProgressStore {
  set: (progress: number) => void;
}

function createNestedSwipeProgressStore(): NestedSwipeProgressStore {
  let progress = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => progress,
    set(nextProgress) {
      const resolved = Number.isFinite(nextProgress) ? nextProgress : 0;
      if (resolved === progress) {
        return;
      }

      progress = resolved;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Reports the drawer's open state to the nearest `Drawer.Provider`, and closes the topmost open
 * drawer on Android back gestures (`CloseWatcher`).
 */
function DrawerProviderReporter() {
  const providerContext = useDrawerProviderContext();
  const store = useDialogRootContext();

  if (providerContext) {
    onCleanup(() => {
      providerContext.removeDrawer(store);
    });

    createEffect(
      () => store.select('open'),
      (open) => {
        providerContext.setDrawerOpen(store, open);
      },
    );
  }

  const closeWatcherState = createMemo(
    () => ({
      open: store.select('open'),
      isTopmost: store.select('nestedOpenDialogCount') === 0,
      popupElement: store.select('popupElement'),
    }),
    {
      equals: (a, b) =>
        a.open === b.open && a.isTopmost === b.isTopmost && a.popupElement === b.popupElement,
    },
  );

  createEffect(closeWatcherState, ({ open, isTopmost, popupElement }) => {
    // CloseWatcher enables the Android back gesture (Chromium-only).
    // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to `createDismiss`.
    if (!open || !isTopmost || !platform.os.android) {
      return undefined;
    }

    const win = ownerWindow(popupElement);

    const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => any) | undefined })
      .CloseWatcher;
    if (!CloseWatcherCtor) {
      return undefined;
    }

    function handleCancel(event: Event) {
      if (!store.select('open')) {
        return;
      }

      const eventDetails = createChangeEventDetails(
        REASONS.closeWatcher,
        event,
      ) as unknown as Parameters<typeof store.setOpen>[1];

      if (!event.cancelable) {
        // The browser lets only one close request per user activation be prevented; any further
        // request closes the drawer regardless, like a native `<dialog>`.
        eventDetails.cancel = NOOP;
      }

      store.setOpen(false, eventDetails);

      if (eventDetails.isCanceled) {
        // Keeps this watcher active for the next close request.
        event.preventDefault();
      }
    }

    const closeWatcher = new CloseWatcherCtor();
    // The browser destroys the watcher before `close` fires, so the request is handled from
    // `cancel`, where it can still be prevented.
    const unsubscribe = addEventListener(closeWatcher, 'cancel', handleCancel);

    return () => {
      unsubscribe();
      closeWatcher.destroy();
    };
  });

  return null;
}
