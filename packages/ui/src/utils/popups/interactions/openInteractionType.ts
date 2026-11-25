import { createEffect, createSignal, type Accessor } from 'solid-js';
import { platform } from '@egoist/solid-base-utils/platform';
import { createEnhancedClickHandler, type InteractionType } from './enhancedClickHandler';

/**
 * Returns trigger props that record the interaction type (mouse, touch, pen, keyboard) that
 * opened the popup.
 *
 * @param open Whether the popup is open (read when the trigger is pressed).
 * @param setOpenMethod Called with the interaction type when the trigger opens the popup.
 */
export function createOpenMethodTriggerProps(
  open: Accessor<boolean>,
  setOpenMethod: (interactionType: InteractionType | null) => void,
) {
  return createEnhancedClickHandler((_event, interactionType) => {
    if (!open()) {
      setOpenMethod(
        interactionType ||
          // On iOS Safari, the hitslop around touch targets means tapping outside an element's
          // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
          // will be "" in that case.
          (platform.os.ios ? 'touch' : ''),
      );
    }
  });
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 *
 * @param open The open state of the component.
 */
export function createOpenInteractionType(open: Accessor<boolean>) {
  const [openMethod, setOpenMethod] = createSignal<InteractionType | null>(null, {
    ownedWrite: true,
  });

  const triggerProps = createOpenMethodTriggerProps(open, setOpenMethod);

  createEffect(
    open,
    (isOpen, previousOpen) => {
      if (previousOpen && !isOpen) {
        setOpenMethod(null);
      }
    },
  );

  return { openMethod, triggerProps };
}
