import { createContext, createEffect, createSignal, onCleanup, useContext, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Timeout, createTimeout } from '@egoist/solid-base-utils/timeout';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import { getDelay } from '../interactions/hoverShared';
import type { PopupInteractionStore, Delay } from '../types';

interface GroupMemberContext {
  closeForSibling: () => void;
  setIsInstantPhase: (value: boolean) => void;
}

interface ContextValue {
  readonly hasProvider: boolean;
  readonly timeoutMs: number;
  delayRef: RefObject<Delay>;
  initialDelayRef: RefObject<Delay>;
  timeout: Timeout;
  currentIdRef: RefObject<string | null | undefined>;
  currentContextRef: RefObject<GroupMemberContext | null>;
}

// Consumers outside a provider share this group, like upstream: opening one closes another.
const FloatingDelayGroupContext = createContext<ContextValue>({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: { current: 0 },
  initialDelayRef: { current: 0 },
  timeout: new Timeout(),
  currentIdRef: { current: null },
  currentContextRef: { current: null },
});

function resetDelayRef(delayRef: RefObject<Delay>, initialDelayRef: RefObject<Delay>) {
  delayRef.current = initialDelayRef.current;
}

export interface FloatingDelayGroupProps {
  children?: JSX.Element;
  /**
   * The delay to use for the group when it's not in the instant phase.
   */
  delay: Delay;
  /**
   * An optional explicit timeout to use for the group, which represents when
   * grouping logic will no longer be active after the close delay completes.
   * This is useful if you want grouping to “last” longer than the close delay,
   * for example if there is no close delay at all.
   */
  timeoutMs?: number | undefined;
}

/**
 * Provides context for a group of floating elements that should share a
 * `delay`. Once one of them opens, the others open instantly until
 * `timeoutMs` passes after it closes.
 * Consumers read the delay through refs, so changing it doesn't re-run
 * unrelated consumers of the context.
 * Based on `NextFloatingDelayGroup` from `@floating-ui/react`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function FloatingDelayGroup(props: FloatingDelayGroupProps): JSX.Element {
  // Seeded by the effect below before any consumer can open.
  const delayRef: RefObject<Delay> = { current: 0 };
  const initialDelayRef: RefObject<Delay> = { current: 0 };
  const currentIdRef: RefObject<string | null | undefined> = { current: null };
  const currentContextRef: RefObject<GroupMemberContext | null> = { current: null };
  const timeout = createTimeout();

  createEffect(
    () => props.delay,
    (delay) => {
      initialDelayRef.current = delay;

      if (!currentIdRef.current) {
        delayRef.current = delay;
        return;
      }

      delayRef.current = {
        open: getDelay(delayRef.current, 'open'),
        close: getDelay(delay, 'close'),
      };
    },
  );

  const value: ContextValue = {
    hasProvider: true,
    delayRef,
    initialDelayRef,
    currentIdRef,
    get timeoutMs() {
      return props.timeoutMs ?? 0;
    },
    currentContextRef,
    timeout,
  };

  return <FloatingDelayGroupContext value={value}>{props.children}</FloatingDelayGroupContext>;
}

export interface CreateDelayGroupOptions {
  /**
   * Whether the trigger this primitive is used in has opened the popup.
   * Read lazily: pass a getter.
   */
  open: boolean;
}

export interface CreateDelayGroupReturnValue {
  /**
   * The id of the floating element keeping the delay group active.
   */
  activeIdRef: RefObject<string | null | undefined>;
  /**
   * The group's current delay (`open: 0` while the group is active).
   */
  delayRef: RefObject<Delay>;
  /**
   * Whether animations should be removed.
   */
  isInstantPhase: Accessor<boolean>;
  /**
   * Whether a `<FloatingDelayGroup>` provider is present.
   */
  hasProvider: boolean;
}

/**
 * Enables grouping when called inside a component that's a child of a
 * `FloatingDelayGroup` (the Solid counterpart of `useDelayGroup`).
 *
 * Options are read lazily, so pass a getter for `open`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function createDelayGroup(
  store: PopupInteractionStore & {
    /**
     * Closes the popup because another popup in the group opened.
     */
    closeForSibling(): void;
  },
  options: CreateDelayGroupOptions,
): CreateDelayGroupReturnValue {
  const groupContext = useContext(FloatingDelayGroupContext);
  const {
    currentIdRef,
    delayRef,
    initialDelayRef,
    currentContextRef,
    hasProvider,
    timeout,
  } = groupContext;

  const [isInstantPhase, setIsInstantPhase] = createSignal(false, { ownedWrite: true });
  // The open state the effects last saw; cleanups read it after `options.open` may have changed.
  let openValue = false;
  let popupId: string | undefined;

  const memberContext: GroupMemberContext = {
    closeForSibling: () => store.closeForSibling(),
    setIsInstantPhase: (value) => setIsInstantPhase(value),
  };

  createEffect(
    () => ({ open: options.open, defaultPopupId: store.select('defaultPopupId') }),
    ({ open, defaultPopupId }) => {
      openValue = open;
      popupId = defaultPopupId;
    },
  );

  createEffect(
    () => ({
      open: options.open,
      defaultPopupId: store.select('defaultPopupId'),
      timeoutMs: groupContext.timeoutMs,
    }),
    ({ open, defaultPopupId, timeoutMs }) => {
      function unset() {
        currentContextRef.current?.setIsInstantPhase(false);
        currentIdRef.current = null;
        currentContextRef.current = null;
        delayRef.current = initialDelayRef.current;
        timeout.clear();
      }

      if (!currentIdRef.current) {
        return undefined;
      }

      if (!open && currentIdRef.current === defaultPopupId) {
        setIsInstantPhase(false);

        if (timeoutMs) {
          const closingId = defaultPopupId;
          timeout.start(timeoutMs, () => {
            // If another tooltip has taken over the group, skip resetting.
            if (
              store.select('open') ||
              (currentIdRef.current && currentIdRef.current !== closingId)
            ) {
              return;
            }
            unset();
          });
          return () => {
            if (openValue || currentIdRef.current !== closingId) {
              timeout.clear();
            }
          };
        }

        unset();
      }

      return undefined;
    },
  );

  createEffect(
    () => ({ open: options.open, defaultPopupId: store.select('defaultPopupId') }),
    ({ open, defaultPopupId }) => {
      if (!open) {
        return;
      }

      const prevContext = currentContextRef.current;
      const prevId = currentIdRef.current;

      // A new tooltip is opening, so cancel any pending timeout that would reset
      // the group's delay back to the initial value.
      timeout.clear();
      currentContextRef.current = memberContext;
      currentIdRef.current = defaultPopupId;
      delayRef.current = {
        open: 0,
        close: getDelay(initialDelayRef.current, 'close'),
      };

      if (prevId !== null && prevId !== defaultPopupId) {
        setIsInstantPhase(true);
        prevContext?.setIsInstantPhase(true);
        prevContext?.closeForSibling();
      } else {
        setIsInstantPhase(false);
        prevContext?.setIsInstantPhase(false);
      }
    },
  );

  onCleanup(() => {
    if (currentIdRef.current === popupId) {
      currentContextRef.current = null;

      if (!openValue) {
        return;
      }

      currentIdRef.current = null;
      resetDelayRef(delayRef, initialDelayRef);
      timeout.clear();
    }
  });

  return {
    activeIdRef: currentIdRef,
    hasProvider,
    delayRef,
    isInstantPhase,
  };
}
