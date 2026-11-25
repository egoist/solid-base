import { createEffect, onCleanup } from 'solid-js';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import { isElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingParentNodeId, useFloatingTree } from '../tree/FloatingTree';
import type { PopupInteractionStore } from '../types';
import { getNodeChildren } from '../tree/nodes';
import { getHoverIntent } from './hoverIntent';

export interface CreateHoverPopupInteractionOptions {
  /**
   * Whether the interaction is enabled, including all internal effects and event handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  closeDelay?: number | (() => number) | undefined;
  /**
   * Tree node id override for floating elements that participate in the tree
   * without a `PopupPositioningContext`, such as inline nested navigation menus.
   */
  nodeId?: string | undefined;
}

/**
 * Provides hover interactions that should be attached to the popup's positioner element: it
 * keeps a hover-opened popup open while the pointer is over it, closes it (after `closeDelay`)
 * when the pointer leaves, hands the close over to the safe polygon while one is active, blocks
 * pointer events outside the popup when the safe polygon asks for it, and closes a parent popup
 * once its hovered nested child closes.
 *
 * The listeners are attached natively to the store's `positionerElement`, so it returns nothing.
 * Options are read lazily, so pass getters for reactive values.
 */
export function createHoverPopupInteraction(
  store: PopupInteractionStore,
  options: CreateHoverPopupInteractionOptions = {},
): void {
  const enabled = () => options.enabled ?? true;

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();
  const intent = getHoverIntent(store);

  const childClosedTimeout = createTimeout();

  createEffect(
    () => store.select('open'),
    (open) => {
      if (!open) {
        intent.reset();
      }
    },
  );

  onCleanup(() => {
    intent.cancelPendingOpen();
    intent.restoreOutsidePointerEvents();
  });

  createEffect(
    () => {
      if (!enabled()) {
        return null;
      }
      return {
        open: store.select('open'),
        anchorElement: store.select('anchorElement'),
        positionerElement: store.select('positionerElement'),
      };
    },
    (params) => {
      if (!params) {
        return undefined;
      }

      const { open, anchorElement, positionerElement } = params;

      if (
        open &&
        isElement(anchorElement) &&
        positionerElement &&
        intent.blockOutsidePointerEventsForPopup(
          anchorElement as HTMLElement | SVGSVGElement,
          positionerElement,
          tree,
          parentId,
        )
      ) {
        return intent.restoreOutsidePointerEvents;
      }

      return undefined;
    },
  );

  createEffect(
    () => (enabled() ? { floating: store.select('positionerElement') } : null),
    (params) => {
      if (!params) {
        return undefined;
      }

      const { floating } = params;

      function hasParentChildren() {
        return !!(tree && parentId && getNodeChildren(tree.nodesRef.current, parentId).length > 0);
      }

      function onFloatingMouseEnter() {
        intent.onPopupMouseEnter();
        childClosedTimeout.clear();
        tree?.events.off('floating.closed', onNodeClosed);
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (hasParentChildren() && tree) {
          tree.events.on('floating.closed', onNodeClosed);
          return;
        }

        intent.onPopupMouseLeave(event, {
          closeDelay: options.closeDelay ?? 0,
          tree,
          nodeId: options.nodeId,
        });
      }

      function onPopupPointerDown(event: PointerEvent) {
        intent.onPopupPointerDown(event);
      }

      function onNodeClosed(event: MouseEvent) {
        if (!tree || !parentId || hasParentChildren()) {
          return;
        }
        // Allow the mouseenter event to fire in case child was closed because mouse moved into parent.
        childClosedTimeout.start(0, () => {
          tree.events.off('floating.closed', onNodeClosed);
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          tree.events.emit('floating.closed', event);
        });
      }

      return mergeCleanups(
        floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
        floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
        floating && addEventListener(floating, 'pointerdown', onPopupPointerDown, true),
        () => {
          tree?.events.off('floating.closed', onNodeClosed);
        },
      );
    },
  );
}
