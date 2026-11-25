import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { getTarget } from '@egoist/solid-base-utils/shadowDom';
import type { ElementProps, PopupInteractionStore } from '../types';
import { isTypeableElement } from '../element';
import { isMouseLikePointerType, isVirtualPointerEvent } from '../event';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';

type PointerType = 'mouse' | 'pen' | 'touch' | 'virtual' | undefined;

export interface CreateClickOptions {
  /**
   * Whether the interaction is enabled.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The type of event to use to determine a “click” with mouse input.
   * Keyboard clicks work as normal.
   * @default 'click'
   */
  event?: 'click' | 'mousedown' | 'mousedown-only' | undefined;
  /**
   * Whether to toggle the open state with repeated clicks.
   * @default true
   */
  toggle?: boolean | undefined;
  /**
   * Whether to ignore the logic for mouse input (for example, if a hover interaction is also
   * being used).
   * @default false
   */
  ignoreMouse?: boolean | undefined;
  /**
   * If already open from another event such as hover, determines whether to keep the floating
   * element open when clicking the reference element for the first time. A function is read when
   * the press is handled.
   * @default true
   */
  stickIfOpen?: boolean | (() => boolean) | undefined;
  /**
   * Touch-only delay (ms) before opening. Useful to allow mobile viewport/keyboard to settle.
   * @default 0
   */
  touchOpenDelay?: number | undefined;
  /**
   * The reason for the click.
   * @default REASONS.triggerPress
   */
  reason?: typeof REASONS.triggerPress | typeof REASONS.inputPress | undefined;
}

/**
 * Opens or closes the floating element when clicking the reference element.
 *
 * Options are read lazily (pass getters for reactive values). Returns `reference` props.
 */
export function createClick(
  store: PopupInteractionStore,
  options: CreateClickOptions = {},
): ElementProps {
  const enabled = () => options.enabled ?? true;
  const eventOption = () => options.event ?? 'click';
  const ignoreMouse = () => options.ignoreMouse ?? false;

  const storeContext = store.context;

  let pointerType: PointerType;
  const frame = createAnimationFrame();
  const touchOpenTimeout = createTimeout();

  function setOpenWithTouchDelay(
    nextOpen: boolean,
    event: MouseEvent,
    target: HTMLElement,
    currentPointerType: PointerType,
  ) {
    const details = createChangeEventDetails(options.reason ?? REASONS.triggerPress, event, target);
    const touchOpenDelay = options.touchOpenDelay ?? 0;

    if (nextOpen && currentPointerType === 'touch' && touchOpenDelay > 0) {
      touchOpenTimeout.start(touchOpenDelay, () => {
        store.setOpen(true, details);
      });
    } else {
      store.setOpen(nextOpen, details);
    }
  }

  function getNextOpen(
    open: boolean,
    currentTarget: EventTarget | null,
    isClickLikeOpenEvent: (eventType: string | undefined) => boolean,
  ) {
    const openEvent = storeContext.openEvent;
    const hasClickedOnInactiveTrigger = store.select('anchorElement') !== currentTarget;

    if (open && hasClickedOnInactiveTrigger) {
      // Moving between triggers should always open the newly active one.
      return true;
    }

    if (!open) {
      // A closed popup should open on the next press.
      return true;
    }

    if (!(options.toggle ?? true)) {
      // Non-toggle mode never closes on a repeated trigger press.
      return true;
    }

    const stickIfOpen = options.stickIfOpen ?? true;
    if (openEvent && (typeof stickIfOpen === 'function' ? stickIfOpen() : stickIfOpen)) {
      // Preserve hover/focus-opened popups until the matching click-like event closes them.
      return !isClickLikeOpenEvent(openEvent.type);
    }

    // Otherwise, a repeated click toggles the popup closed.
    return false;
  }

  const reference = {
    onPointerDown(event: PointerEvent) {
      if (!enabled()) {
        return;
      }
      // Screen reader activations report a mouse-like `pointerType`, but `ignoreMouse` must not
      // drop them: hover logic cannot open for a virtual press since there is no real pointer
      // movement to wait for. Virtual `touch` presses keep their type so `touchOpenDelay` applies.
      pointerType =
        isMouseLikePointerType(event.pointerType, true) && isVirtualPointerEvent(event)
          ? 'virtual'
          : (event.pointerType as PointerType);
    },
    onMouseDown(event: MouseEvent) {
      if (!enabled()) {
        return;
      }
      const currentPointerType = pointerType;
      const open = store.select('open');

      // Ignore all buttons except for the "main" button.
      if (
        event.button !== 0 ||
        eventOption() === 'click' ||
        (isMouseLikePointerType(currentPointerType, true) && ignoreMouse())
      ) {
        return;
      }

      const nextOpen = getNextOpen(
        open,
        event.currentTarget,
        (openEventType) => openEventType === 'click' || openEventType === 'mousedown',
      );

      // Animations sometimes won't run on a typeable element if using a rAF.
      // Focus is always set on these elements. For touch, we may delay opening.
      // A screen reader press opens synchronously, so the popup's focus lands before the reader
      // re-syncs focus to its cursor.
      const target = getTarget(event);
      const isTypeable = isTypeableElement(target);

      if (isTypeable || currentPointerType === 'virtual') {
        // A virtual press may target a descendant of the trigger; the trigger is what opened.
        const pressedElement = (isTypeable ? target : event.currentTarget) as HTMLElement;

        // The reader only moves focus to its cursor after the press, so focus the trigger first.
        if (!open && !isTypeable && !event.defaultPrevented) {
          pressedElement.focus({ preventScroll: true });
        }

        setOpenWithTouchDelay(nextOpen, event, pressedElement, currentPointerType);
        return;
      }

      // Capture the currentTarget before the rAF.
      const eventCurrentTarget = event.currentTarget as HTMLElement;

      // Wait until focus is set on the element. This is an alternative to
      // `event.preventDefault()` to avoid :focus-visible from appearing when using a pointer.
      frame.request(() => {
        setOpenWithTouchDelay(nextOpen, event, eventCurrentTarget, currentPointerType);
      });
    },
    onClick(event: MouseEvent) {
      if (!enabled()) {
        return;
      }
      const option = eventOption();
      if (option === 'mousedown-only') {
        return;
      }

      const currentPointerType = pointerType;

      if (option === 'mousedown' && currentPointerType) {
        pointerType = undefined;
        return;
      }

      if (isMouseLikePointerType(currentPointerType, true) && ignoreMouse()) {
        return;
      }

      const open = store.select('open');
      const nextOpen = getNextOpen(
        open,
        event.currentTarget,
        (openEventType) =>
          openEventType === 'click' ||
          openEventType === 'mousedown' ||
          openEventType === 'keydown' ||
          openEventType === 'keyup',
      );
      setOpenWithTouchDelay(
        nextOpen,
        event,
        event.currentTarget as HTMLElement,
        currentPointerType,
      );
    },
    onKeyDown() {
      pointerType = undefined;
    },
  };

  return { reference };
}
