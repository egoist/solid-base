import { createEffect, type Accessor } from 'solid-js';
import { isDev } from '@solidjs/web';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { warn } from '@egoist/solid-base-utils/warn';
import { activeElement, contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { isTypeableElement } from '../../utils/popups/element';
import { useFilterDropdownRootContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import {
  refocusOwner,
  isRefocusingOwner,
} from '../../filter-dropdown/utils/refocusOwner';
import type { MenuRoot } from '../root/MenuRoot';
import { isCrossOrientationCloseKey } from '../../utils/popups/interactions/listNavigation';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { HTMLProps } from '../../internals/types';

/**
 * The interaction props of a filterable menu's popup, which keeps real focus on the input.
 */
export function createMenuFilterPopup(orientation: Accessor<MenuRoot.Orientation>): HTMLProps {
  const context = useFilterDropdownRootContext();
  const direction = useDirection();
  const { focusOwnerRef } = context;

  // Focus that entered a nested popup by keyboard or click stays there while the
  // pointer crosses the parent popup. Returning to a submenu trigger restores focus to the
  // parent input. Focus that merely followed the pointer in follows it back out.
  let nestedFocus: Element | null = null;
  // A tap fires compatibility mouse events, which must not focus the input and raise the
  // on-screen keyboard.
  let pointerType = 'mouse';

  function trackPointerType(event: PointerEvent) {
    pointerType = event.pointerType || 'mouse';
  }

  if (isDev) {
    createEffect(
      () => context.open,
      (open) => {
        if (open && focusOwnerRef.current === null) {
          warn(
            'A filterable menu opened without a <Menu.Input>. Render the input inside ' +
              '<Menu.Popup>, or drop <Menu.FilterProvider> for a menu that does not filter.',
          );
        }
      },
    );
  }

  function restoreInputFocus(event: MouseEvent, enteredTrigger: boolean) {
    const focusOwner = focusOwnerRef.current;
    const currentTarget = event.currentTarget as HTMLElement;
    if (!context.open || !focusOwner) {
      return;
    }

    const activeEl = activeElement(ownerDocument(currentTarget));
    if (activeEl === focusOwner || contains(currentTarget, activeEl)) {
      return;
    }

    // Nested popups are portalled, so their events still bubble through this component tree.
    // The composed path only contains this popup when the pointer is really over it, and a
    // closing popup must not re-capture focus during its exit transition.
    let submenuTrigger: HTMLElement | null = null;
    const nearestPopup = event.composedPath().find((node) => {
      if (!isHTMLElement(node)) {
        return false;
      }
      if (node.getAttribute('role') === 'dialog' || node.hasAttribute('data-rootownerid')) {
        return true;
      }
      if (node.hasAttribute('aria-haspopup')) {
        submenuTrigger = node;
      }
      return false;
    });
    if (nearestPopup !== currentTarget) {
      return;
    }

    // A nested popup that took focus keeps it while the pointer moves over the parent popup.
    // Entering a submenu trigger returns focus to the parent's input.
    if (nestedFocus && !(enteredTrigger && submenuTrigger)) {
      return;
    }
    if (
      enteredTrigger &&
      submenuTrigger &&
      isElement(event.relatedTarget) &&
      contains(submenuTrigger, event.relatedTarget as Element)
    ) {
      return;
    }
    refocusOwner(focusOwner);
  }

  return {
    // The input owns virtual focus.
    'aria-activedescendant': undefined,
    // Not valid on a dialog; the list's implicit orientation is already vertical.
    'aria-orientation': undefined,
    onMouseDown(event: MouseEvent) {
      if (getTarget(event) === event.currentTarget) {
        // Keep focus on the virtual focus owner when the popup's own background is pressed.
        event.preventDefault();
      }
    },
    onPointerDown: trackPointerType,
    // `pointerover` precedes the compatibility `mouseover`, so a mouse entering right after a tap
    // is recognized before the handoff below.
    onPointerOver: trackPointerType,
    onPointerMove: trackPointerType,
    onMouseMove(event: MouseEvent) {
      if (pointerType === 'mouse') {
        restoreInputFocus(event, false);
      }
    },
    onMouseOver(event: MouseEvent) {
      if (pointerType === 'mouse' && nestedFocus) {
        restoreInputFocus(event, true);
      }
    },
    onFocusIn(event: FocusEvent) {
      // `focusin` bubbles, so this also sees the owner itself being focused.
      const target = getTarget(event);
      const currentTarget = event.currentTarget as HTMLElement;

      // Nested popups are portalled, so their focus events bubble through this component tree
      // while their elements sit outside this one in the DOM.
      if (target === focusOwnerRef.current) {
        nestedFocus = null;
      } else if (
        isHTMLElement(target) &&
        !contains(currentTarget, target as Element) &&
        !isRefocusingOwner()
      ) {
        nestedFocus = target as Element;
      }

      // Focus that lands on the popup itself, the focus manager's fallback target, moves on to
      // the input, which owns focus while the menu filters.
      if (context.open && target === currentTarget) {
        focusOwnerRef.current?.focus({ preventScroll: true });
      }
    },
    onKeyDown(event: KeyboardEvent) {
      const target = getTarget(event);
      if (target === focusOwnerRef.current || isTypeableElement(target)) {
        return;
      }

      if (isCrossOrientationCloseKey(event.key, orientation(), direction() === 'rtl', false)) {
        focusOwnerRef.current?.focus({ preventScroll: true });
        // Nested popups bubble through this component tree, so keep the key from the parent.
        event.stopPropagation();
      }
    },
  } as HTMLProps;
}
