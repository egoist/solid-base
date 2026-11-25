import { createEffect, onCleanup } from 'solid-js';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { contains } from '@egoist/solid-base-utils/shadowDom';
import { isElement } from '@floating-ui/utils/dom';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../../internals/types';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { Delay, PopupInteractionStore } from '../types';
import { getHoverIntent } from './hoverIntent';
import type { HoverIntentTriggerOptions } from './hoverIntent';
import type { HandleClose, HandleCloseContextBase } from './hoverShared';

export interface CreateHoverTriggerInteractionOptions {
  /**
   * Whether the interaction is enabled, including all internal effects and event handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Decides when the popup closes after the pointer leaves the trigger, such as `safePolygon()`.
   * Without it, the popup closes (after the close delay) as soon as the pointer leaves.
   * @default null
   */
  handleClose?: HandleClose | null | undefined;
  /**
   * Waits until the pointer rests on the trigger for this long (in ms) before opening.
   * @default 0
   */
  restMs?: number | (() => number) | undefined;
  /**
   * Waits for the specified time (in ms) before opening or closing. A number applies to both.
   * @default 0
   */
  delay?: Delay | (() => Delay) | undefined;
  /**
   * Whether moving the pointer over the trigger (not only entering it) can open the popup.
   * @default true
   */
  move?: boolean | undefined;
  /**
   * Whether only mouse-like pointers (mouse, pen) open the popup.
   * @default false
   */
  mouseOnly?: boolean | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   * Read once, when the interaction is created.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Whether the trigger is the popup's active trigger. Only the active trigger sets the safe
   * polygon options the popup uses, and listens on the store's anchor element when
   * `triggerElement` isn't set.
   * @default true
   */
  isActiveTrigger?: boolean | undefined;
  /**
   * The element the `mouseenter`/`mouseleave` listeners are attached to. Defaults to the store's
   * anchor element for the active trigger. Pass a getter over a signal so the listeners follow
   * the element.
   */
  triggerElement?: Element | null | undefined;
  /**
   * Returns the safe polygon context when the popup has no positioning context.
   */
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
  /**
   * Called before each hover-driven open attempt (immediate, delayed, and rest-ms
   * paths). Return `false` to veto; any other return value permits the open.
   */
  shouldOpen?: (() => boolean) | undefined;
  /**
   * Regression workaround (#5152): also cancels a pending hover-open from the
   * trigger's `mouseout`, backing up a `mouseleave` that Chrome can drop during
   * a fast pointer sweep and leave a submenu stuck open.
   *
   * WARNING: only enable on single-trigger, hover-driven roots (e.g.
   * `Menu.SubmenuTrigger`). It skips the `isClickLikeOpenEvent()` and
   * `isInsideEnabledTrigger()` checks `mouseleave` applies, so on a
   * multi-trigger or click-driven root it cancels legitimate opens/closes.
   * @default false
   */
  guardStaleOpen?: boolean | undefined;
}

/**
 * Provides hover interactions that should be attached to trigger elements: it opens the popup
 * when the pointer enters (or rests on) the trigger and closes it when the pointer leaves,
 * honoring the open/close delays and the `handleClose` strategy (such as `safePolygon()`).
 *
 * The `mouseenter`/`mouseleave` listeners are attached natively to `triggerElement` (or the
 * store's anchor element); the returned props (pointer type tracking and rest detection) go on
 * the trigger element. They are created once; their handlers do nothing while disabled.
 *
 * Options are read lazily, so pass getters for reactive values.
 */
export function createHoverTriggerInteraction(
  store: PopupInteractionStore,
  options: CreateHoverTriggerInteractionOptions = {},
): HTMLProps {
  const enabled = () => options.enabled ?? true;
  const mouseOnly = () => options.mouseOnly ?? false;
  const isActiveTrigger = () => options.isActiveTrigger ?? true;

  const { events } = store.context;

  const tree = useFloatingTree(options.externalTree);

  const intent = getHoverIntent(store);
  const isHoverCloseActiveRef = { current: false };

  function checkShouldOpen() {
    return options.shouldOpen?.() !== false;
  }

  const intentOptions: HoverIntentTriggerOptions = {
    delay: {
      get current() {
        return options.delay ?? 0;
      },
    },
    restMs: {
      get current() {
        return options.restMs ?? 0;
      },
    },
    handleClose: {
      get current() {
        return options.handleClose ?? null;
      },
    },
    enabled: {
      get current() {
        return enabled();
      },
    },
    isHoverCloseActive: isHoverCloseActiveRef,
    triggerElementRef: {
      get current() {
        return options.triggerElement ?? null;
      },
    },
    get mouseOnly() {
      return mouseOnly();
    },
    tree,
    shouldOpen: checkShouldOpen,
    get getHandleCloseContext() {
      return options.getHandleCloseContext;
    },
  };

  // The active trigger publishes its safe polygon options to the popup.
  createEffect(
    () => (isActiveTrigger() ? { options: options.handleClose?.__options } : null),
    (active) => {
      if (active) {
        intent.handleCloseOptions = active.options;
      }
    },
  );

  // Clears the timers and the safe polygon when the trigger unmounts.
  onCleanup(() => {
    intent.cancelPendingOpen();
    intent.stopSafePolygon();
  });

  // When closing before opening, clear the delay timeouts to cancel it
  // from showing.
  createEffect(enabled, (isEnabled) => {
    if (!isEnabled) {
      return undefined;
    }

    function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
      if (!details.open) {
        isHoverCloseActiveRef.current = details.reason === REASONS.triggerHover;
        intent.cancel();
      } else {
        isHoverCloseActiveRef.current = false;
      }
    }

    events.on('openchange', onOpenChangeLocal);
    return () => {
      events.off('openchange', onOpenChangeLocal);
    };
  });

  createEffect(
    () => {
      if (!enabled()) {
        return null;
      }
      const trigger =
        options.triggerElement ?? (isActiveTrigger() ? store.select('anchorElement') : null);
      return {
        trigger,
        move: options.move ?? true,
        guardStaleOpen: options.guardStaleOpen ?? false,
      };
    },
    (params) => {
      if (!params || !isElement(params.trigger)) {
        return undefined;
      }

      const trigger = params.trigger as HTMLElement;

      function onMouseEnter(event: MouseEvent) {
        intent.onTriggerMouseEnter(event, intentOptions);
      }

      function onMouseLeave(event: MouseEvent) {
        intent.onTriggerMouseLeave(event, intentOptions);
      }

      // Backup cancellation for Chrome's dropped `mouseleave` — see `guardStaleOpen`.
      function onMouseOut(event: MouseEvent) {
        if (contains(trigger, event.relatedTarget as Element | null)) {
          return; // moved within the trigger's own subtree
        }
        intent.cancelPendingOpen();
      }

      return mergeCleanups(
        params.move && addEventListener(trigger, 'mousemove', onMouseEnter, { once: true }),
        addEventListener(trigger, 'mouseenter', onMouseEnter),
        addEventListener(trigger, 'mouseleave', onMouseLeave),
        params.guardStaleOpen && addEventListener(trigger, 'mouseout', onMouseOut),
      );
    },
  );

  function setPointerRef(event: PointerEvent) {
    if (!enabled()) {
      return;
    }
    intent.pointerType = event.pointerType;
  }

  return {
    onPointerDown: setPointerRef,
    onPointerEnter: setPointerRef,
    onMouseMove(event: MouseEvent) {
      if (!enabled()) {
        return;
      }
      intent.onTriggerMouseMove(event, {
        restMs: intentOptions.restMs,
        mouseOnly: mouseOnly(),
        shouldOpen: checkShouldOpen,
      });
    },
  } as HTMLProps;
}
