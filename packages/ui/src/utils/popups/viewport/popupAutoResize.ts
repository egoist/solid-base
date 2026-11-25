import { createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createAnimationFrame } from '@egoist/solid-base-utils/animationFrame';
import { NOOP, EMPTY_OBJECT } from '@egoist/solid-base-utils/empty';
import type { Dimensions } from '@floating-ui/utils';
import { createAnimationsFinished } from '../../../internals/animationsFinished';
import { getCssDimensions } from '../../getCssDimensions';
import type { Side } from '../../../internals/anchorPositioning';
import * as CommonPopupCssVars from './CommonPopupCssVars';
import * as CommonPositionerCssVars from '../positioning/CommonPositionerCssVars';

export interface CreatePopupAutoResizeParameters {
  /**
   * Element to resize.
   */
  readonly popupElement: HTMLElement | null | undefined;
  /*
   * Positioner element (parent of the popup)
   */
  readonly positionerElement: HTMLElement | null | undefined;
  /**
   * Whether the popup is mounted.
   */
  readonly mounted: boolean;
  /*
   * Content that may change and trigger a resize.
   * This doesn't have to be the actual content of the popup, but a value that triggers a resize.
   */
  readonly content: unknown;
  /**
   * Callback fired immediately before measuring the dimensions of the new content.
   */
  onMeasureLayout?: (() => void) | undefined;
  /**
   * Callback fired after the new dimensions have been measured.
   *
   * @param previousDimensions Dimensions before the change, or `null` if this is the first measurement.
   * @param newDimensions Newly measured dimensions.
   */
  onMeasureLayoutComplete?:
    | ((previousDimensions: Dimensions | null, newDimensions: Dimensions) => void)
    | undefined;

  readonly side: Side;
  readonly direction: 'ltr' | 'rtl';
}

/**
 * Allows the element to automatically resize based on its content while supporting animations.
 *
 * Parameters are read lazily, like Solid props: pass getters for reactive values
 * (`{ get popupElement() { return store.select('popupElement') }, ... }`). The measurement re-runs
 * whenever `content`, `popupElement`, `positionerElement`, `mounted`, `side` or `direction`
 * changes. The callbacks are read when called.
 */
export function createPopupAutoResize(parameters: CreatePopupAutoResizeParameters): void {
  const runOnceAnimationsFinish = createAnimationsFinished(() => parameters.popupElement, true);

  const animationFrame = createAnimationFrame();

  let committedDimensions: Dimensions | null = null;

  createEffect(
    () => {
      // Track `content`: a change re-measures the popup.
      void parameters.content;
      return {
        mounted: parameters.mounted,
        popupElement: parameters.popupElement ?? null,
        positionerElement: parameters.positionerElement ?? null,
        anchoringStyles: getPopupAnchoringStyles(parameters.side, parameters.direction),
      };
    },
    ({ mounted, popupElement, positionerElement, anchoringStyles }) => {
      // Reset the state when the popup is closed.
      if (!mounted) {
        committedDimensions = null;
        return undefined;
      }

      if (!popupElement || !positionerElement) {
        return undefined;
      }

      const restoreAnchoringStyles = applyElementStyles(
        popupElement,
        anchoringStyles as Record<string, string>,
      );

      // Measure the rendered size to enable transitions:
      setPopupCssSize(popupElement, 'auto');

      const restorePopupPosition = overrideElementStyle(popupElement, 'position', 'static');
      const restorePopupTransform = overrideElementStyle(popupElement, 'transform', 'none');
      const restorePopupScale = overrideElementStyle(popupElement, 'scale', '1');
      const restorePositionerAvailableSize = applyElementStyles(positionerElement, {
        [CommonPositionerCssVars.availableWidth]: 'max-content',
        [CommonPositionerCssVars.availableHeight]: 'max-content',
      });

      function restoreMeasurementOverrides() {
        restorePopupPosition();
        restorePopupTransform();
        restorePositionerAvailableSize();
        restorePopupScale();
      }

      parameters.onMeasureLayout?.();

      // Initial render (for each time the popup opens).
      if (committedDimensions === null) {
        setPositionerCssSize(positionerElement, 'max-content');

        const dimensions = getCssDimensions(popupElement);

        committedDimensions = dimensions;

        setPositionerCssSize(positionerElement, dimensions);
        restoreMeasurementOverrides();
        parameters.onMeasureLayoutComplete?.(null, dimensions);

        return restoreAnchoringStyles;
      }

      // Subsequent renders while open (when `content` changes).
      setPositionerCssSize(positionerElement, 'max-content');

      const previousDimensions = committedDimensions;
      const newDimensions = getCssDimensions(popupElement);

      // Commit immediately so future content changes have a stable previous size.
      committedDimensions = newDimensions;

      setPopupCssSize(popupElement, previousDimensions);
      restoreMeasurementOverrides();
      parameters.onMeasureLayoutComplete?.(previousDimensions, newDimensions);

      setPositionerCssSize(positionerElement, newDimensions);

      const abortController = new AbortController();

      animationFrame.request(() => {
        setPopupCssSize(popupElement, newDimensions);

        runOnceAnimationsFinish(() => {
          popupElement.style.setProperty(CommonPopupCssVars.popupWidth, 'auto');
          popupElement.style.setProperty(CommonPopupCssVars.popupHeight, 'auto');
        }, abortController.signal);
      });

      return () => {
        abortController.abort();
        animationFrame.cancel();
        restoreAnchoringStyles();
      };
    },
  );
}

function getPopupAnchoringStyles(side: Side, direction: 'ltr' | 'rtl'): JSX.CSSProperties {
  // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
  const isPhysicalTop = side === 'top';
  const isPhysicalLeft =
    side === 'left' || side === (direction === 'rtl' ? 'inline-end' : 'inline-start');

  if (!isPhysicalTop && !isPhysicalLeft) {
    return EMPTY_OBJECT as JSX.CSSProperties;
  }

  return {
    position: 'absolute',
    [isPhysicalTop ? 'bottom' : 'top']: '0',
    [isPhysicalLeft ? 'right' : 'left']: '0',
  };
}

function overrideElementStyle(element: HTMLElement, property: string, value: string) {
  const originalValue = element.style.getPropertyValue(property);
  element.style.setProperty(property, value);

  return () => {
    element.style.setProperty(property, originalValue);
  };
}

function applyElementStyles(element: HTMLElement, styles: Record<string, string>) {
  const restorers: Array<() => void> = [];

  for (const [key, value] of Object.entries(styles)) {
    restorers.push(overrideElementStyle(element, key, value));
  }

  return restorers.length
    ? () => {
        restorers.forEach((restore) => restore());
      }
    : NOOP;
}

function setPopupCssSize(popupElement: HTMLElement, size: Dimensions | 'auto') {
  const width = size === 'auto' ? 'auto' : `${size.width}px`;
  const height = size === 'auto' ? 'auto' : `${size.height}px`;
  popupElement.style.setProperty(CommonPopupCssVars.popupWidth, width);
  popupElement.style.setProperty(CommonPopupCssVars.popupHeight, height);
}

function setPositionerCssSize(positionerElement: HTMLElement, size: Dimensions | 'max-content') {
  const width = size === 'max-content' ? 'max-content' : `${size.width}px`;
  const height = size === 'max-content' ? 'max-content' : `${size.height}px`;
  positionerElement.style.setProperty(CommonPositionerCssVars.positionerWidth, width);
  positionerElement.style.setProperty(CommonPositionerCssVars.positionerHeight, height);
}
