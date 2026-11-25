import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { platform } from '@egoist/solid-base-utils/platform';
import { closest, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { FOCUSABLE_ATTRIBUTE, TYPEABLE_SELECTOR } from './constants';
import type { PopupTriggerMap } from './popupTriggerMap';

/**
 * Present on a tooltip trigger that is disabled (`TooltipTriggerDataAttributes.triggerDisabled`).
 */
const TRIGGER_DISABLED_ATTRIBUTE = 'data-trigger-disabled';

export function isTargetInsideEnabledTrigger(
  target: EventTarget | null,
  triggerElements: PopupTriggerMap,
) {
  if (!isElement(target)) {
    return false;
  }

  const targetElement = target as Element;

  if (triggerElements.hasElement(targetElement)) {
    return !targetElement.hasAttribute(TRIGGER_DISABLED_ATTRIBUTE);
  }

  for (const [, trigger] of triggerElements.entries()) {
    if (contains(trigger, targetElement)) {
      return !trigger.hasAttribute(TRIGGER_DISABLED_ATTRIBUTE);
    }
  }

  return false;
}

export function isEventTargetWithin(event: Event, node: Node | null | undefined) {
  if (node == null) {
    return false;
  }

  if ('composedPath' in event) {
    const path = event.composedPath();
    if (path.length > 0) {
      return path.includes(node);
    }
  }

  const target = (event as Event).target;
  return target != null && contains(node as Element, target as Element);
}

export function isRootElement(element: Element): boolean {
  return element.matches('html,body');
}

export function isTypeableElement(element: unknown): boolean {
  return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR);
}

export function isInteractiveElement(element: Element | null) {
  return (
    closest(
      element,
      `button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`,
    ) != null
  );
}

export function isTypeableCombobox(element: Element | null) {
  if (!element) {
    return false;
  }
  return element.getAttribute('role') === 'combobox' && isTypeableElement(element);
}

export function matchesFocusVisible(element: Element | null) {
  // We don't want to block focus from working with `visibleOnly`
  // (JSDOM doesn't match `:focus-visible` when the element has `:focus`)
  if (!element || platform.env.jsdom) {
    return true;
  }
  try {
    return element.matches(':focus-visible');
  } catch (_e) {
    return true;
  }
}

export function getFloatingFocusElement(
  positionerElement: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!positionerElement) {
    return null;
  }
  // Try to find the element that has the floating props spread on it.
  // This indicates the floating element is acting as a positioning wrapper, and
  // so focus should be managed on the child element with the event handlers and
  // aria props.
  return positionerElement.hasAttribute(FOCUSABLE_ATTRIBUTE)
    ? positionerElement
    : positionerElement.querySelector<HTMLElement>(`[${FOCUSABLE_ATTRIBUTE}]`) ||
        positionerElement;
}

/**
 * The parent of a node in the *component* tree: Solid tags the top-level nodes rendered by a
 * `<Portal>` with a `_$host` getter pointing at the portal's location, so its event delegation
 * bubbles through portals. We follow the same link to answer "was this rendered inside that
 * element?" the way React's synthetic events do.
 */
function getComponentParent(node: Node): Node | null {
  return (
    (node as Node & { _$host?: Node | null })._$host ??
    node.parentNode ??
    (node as unknown as ShadowRoot).host ??
    null
  );
}

/**
 * Whether `node` was rendered inside `ancestor` in the component tree, which crosses portals.
 * Equivalent to "an event from `node` would bubble through `ancestor` in the React tree".
 */
export function isInsideComponentTree(
  ancestor: Node | null | undefined,
  node: Node | null | undefined,
): boolean {
  if (!ancestor || !node) {
    return false;
  }
  if (contains(ancestor as Element, node as Element)) {
    return true;
  }
  let current: Node | null = node;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = getComponentParent(current);
  }
  return false;
}

/**
 * Whether the target of `event` was rendered inside `ancestor` in the component tree.
 */
export function isEventInsideComponentTree(event: Event, ancestor: Node | null | undefined) {
  return isInsideComponentTree(ancestor, getTarget(event) as Node | null);
}
