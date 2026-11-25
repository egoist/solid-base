import type { Placement } from '@floating-ui/dom';
import { isMouseLikePointerType } from '../event';
import type { ExtendedElements, FloatingTreeType } from '../types';

export { isTargetInsideEnabledTrigger as isInsideEnabledTrigger } from '../element';

/**
 * Options of a `handleClose` function (such as `safePolygon()`), exposed on its `__options`.
 */
export interface HandleCloseOptions {
  /**
   * Whether to block pointer events outside the trigger and the popup while the pointer travels
   * between them.
   */
  blockPointerEvents?: boolean | undefined;
  /**
   * Returns the element whose pointer events are blocked. Defaults to the document body.
   */
  getScope?: (() => HTMLElement | SVGSVGElement | null) | undefined;
}

/**
 * What a `handleClose` function receives when the pointer leaves the trigger.
 */
export interface HandleCloseContext {
  /**
   * The pointer's x coordinate when it left the trigger.
   */
  x: number | null;
  /**
   * The pointer's y coordinate when it left the trigger.
   */
  y: number | null;
  /**
   * The popup's placement.
   */
  placement: Placement | null;
  elements: Pick<ExtendedElements, 'domReference' | 'floating'>;
  /**
   * Closes the popup.
   */
  onClose: () => void;
  /**
   * The popup's floating tree node id.
   */
  nodeId?: string | undefined;
  tree?: FloatingTreeType | null | undefined;
  leave?: boolean | undefined;
}

/**
 * The part of `HandleCloseContext` that a popup provides (usually its positioning context).
 */
export type HandleCloseContextBase = Omit<HandleCloseContext, 'onClose' | 'tree' | 'x' | 'y'>;

/**
 * Decides when the popup closes after the pointer leaves the trigger. Returns a `mousemove`
 * handler that is attached to the document until it calls `onClose`.
 */
export interface HandleClose {
  (context: HandleCloseContext): (event: MouseEvent) => void;
  __options?: HandleCloseOptions | undefined;
}

type HoverDelay = number | Partial<{ open: number; close: number }>;

function resolveValue<T>(
  value: T | (() => T) | undefined,
  pointerType?: PointerEvent['pointerType'],
): T | 0 | undefined {
  if (pointerType != null && !isMouseLikePointerType(pointerType)) {
    return 0;
  }

  if (typeof value === 'function') {
    return (value as () => T)();
  }

  return value;
}

/**
 * Resolves the open or close delay of a hover interaction. Touch and other non-mouse pointers
 * get no delay.
 */
export function getDelay(
  value: HoverDelay | (() => HoverDelay) | undefined,
  prop: 'open' | 'close',
  pointerType?: PointerEvent['pointerType'],
) {
  const result = resolveValue(value, pointerType);
  if (typeof result === 'number') {
    return result;
  }

  return result?.[prop];
}

/**
 * Resolves the rest time (in ms) after which a resting pointer opens the popup.
 */
export function getRestMs(value: number | (() => number)) {
  if (typeof value === 'function') {
    return value();
  }
  return value;
}

/**
 * Whether the popup was opened by a click-like event or a press inside it, in which case hover
 * doesn't close it.
 */
export function isClickLikeOpenEvent(openEventType: string | undefined, interactedInside: boolean) {
  return interactedInside || openEventType === 'click' || openEventType === 'mousedown';
}

/**
 * Whether the popup was opened by hovering.
 */
export function isHoverOpenEvent(openEventType: string | undefined) {
  return openEventType?.includes('mouse') && openEventType !== 'mousedown';
}
