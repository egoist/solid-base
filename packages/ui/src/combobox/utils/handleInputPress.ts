import { isElement } from '@floating-ui/utils/dom';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { isInteractiveElement } from '../../utils/popups/element';
import type { ComboboxStore } from '../store';

/**
 * Focuses the input (and opens the popup) when a container around it, such as the chips or the
 * input group, is pressed.
 */
export function handleInputPress(
  event: MouseEvent & { baseUIHandlerPrevented?: boolean | undefined },
  store: ComboboxStore,
  disabled: boolean,
  shouldIgnoreTarget?: ((target: Element | null) => boolean) | undefined,
) {
  if (event.baseUIHandlerPrevented) {
    return;
  }

  const currentTarget = event.currentTarget as Element;
  const target = getTarget(event);
  const targetElement = isElement(target) ? target : null;

  if (targetElement && !contains(currentTarget, targetElement)) {
    return;
  }

  if (
    targetElement !== currentTarget &&
    (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))
  ) {
    return;
  }

  event.preventDefault();

  if (disabled) {
    return;
  }

  store.context.inputRef.current?.focus();

  if (store.state.openOnInputClick) {
    store.setOpen(true, createChangeEventDetails(REASONS.inputPress, event));
  }
}
