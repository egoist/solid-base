import { createEffect, createSignal } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import { createScrollLock } from '@egoist/solid-base-utils/scrollLock';
import { contains, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import type { DialogStore } from '../store/DialogStore';
import { createPopupInteractionProps } from '../../utils/popups/popupStoreUtils';

/**
 * Wires the interactions of a Dialog Root: dismissal (Escape, outside press on the dialog's own
 * backdrop), the page scroll lock of modal dialogs, and the nested dialog/drawer counts reported
 * to the parent Root.
 */
export function createDialogInteractions(
  store: DialogStore<any>,
  parentContext: DialogStore<unknown>['context'] | undefined,
  isDrawer: boolean,
) {
  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const modal = () => store.select('modal');

  const [ownNestedOpenDialogs, setOwnNestedOpenDialogs] = createSignal(0);
  const [ownNestedOpenDrawers, setOwnNestedOpenDrawers] = createSignal(0);
  // Plain mirrors: reads of the signals lag their writes.
  let nestedDialogs = 0;
  const isTopmost = () => ownNestedOpenDialogs() === 0;

  const dismiss = createDismiss(store, {
    outsidePressEvent() {
      if (store.context.internalBackdropElement || store.context.backdropElement) {
        return 'intentional';
      }
      // Ensure `aria-hidden` on outside elements is removed immediately on outside press when
      // trapping focus.
      return {
        mouse: store.state.modal === 'trap-focus' ? 'sloppy' : 'intentional',
        touch: 'sloppy',
      };
    },
    outsidePress(event) {
      if (!store.context.outsidePressEnabled) {
        return false;
      }

      // For mouse events, only accept left button (button 0).
      // For touch events, a single touch is equivalent to left button.
      if ('button' in event && event.button !== 0) {
        return false;
      }
      if ('touches' in event) {
        // Outside press can be handled on `touchend`, where the lifted point is reported in
        // `changedTouches` and `touches` contains any remaining active points.
        if (event.type === 'touchend') {
          if (event.changedTouches.length !== 1 || event.touches.length !== 0) {
            return false;
          }
        } else if (event.touches.length !== 1) {
          return false;
        }
      }

      const target = getTarget(event) as Element | null;
      if (nestedDialogs === 0 && !store.state.disablePointerDismissal) {
        // Only close if the click occurred on the dialog's owning backdrop.
        // This supports multiple modal dialogs that aren't nested in the component tree:
        // https://github.com/mui/base-ui/issues/1320
        if (store.state.modal) {
          const internalBackdrop = store.context.internalBackdropElement;
          const backdrop = store.context.backdropElement;
          const popupElement = store.state.popupElement;
          return internalBackdrop || backdrop
            ? internalBackdrop === target ||
                backdrop === target ||
                // `target` can be the document, which contains the popup but isn't an element.
                (contains(target, popupElement) &&
                  !(isElement(target) && target.hasAttribute('data-base-ui-portal')))
            : true;
        }
        return true;
      }
      return false;
    },
    get escapeKey() {
      return isTopmost();
    },
  });

  createScrollLock(
    () => open() && modal() === true,
    () => store.select('popupElement'),
  );

  // Nested Roots report their open dialog/drawer counts here. A close notification is an open
  // notification with zeroed counts.
  store.context.onNestedDialogOpen = (dialogCount, drawerCount) => {
    // A handle-backed root keeps these interactions alive while closed. Ignore nested roots that
    // open meanwhile so their counts don't carry into the next open session.
    if (!store.state.open && !store.state.mounted) {
      return;
    }
    nestedDialogs = dialogCount;
    setOwnNestedOpenDialogs(dialogCount);
    setOwnNestedOpenDrawers(drawerCount);
  };

  createEffect(
    () => open() || mounted(),
    (active) => {
      if (!active) {
        nestedDialogs = 0;
        setOwnNestedOpenDialogs(0);
        setOwnNestedOpenDrawers(0);
      }
    },
  );

  // Notify the parent of our open/close state.
  if (parentContext) {
    createEffect(
      () => [open(), ownNestedOpenDialogs(), ownNestedOpenDrawers()] as const,
      ([isOpen, dialogs, drawers]) => {
        if (!isOpen) {
          return undefined;
        }
        parentContext.onNestedDialogOpen?.(dialogs + 1, drawers + (isDrawer ? 1 : 0));
        return () => {
          parentContext.onNestedDialogOpen?.(0, 0);
        };
      },
    );
  }

  store.bind('nestedOpenDialogCount', ownNestedOpenDialogs);
  store.bind('nestedOpenDrawerCount', ownNestedOpenDrawers);

  createPopupInteractionProps(store, {
    // `trigger` is the same object as `reference`.
    activeTriggerProps: dismiss.reference!,
    inactiveTriggerProps: dismiss.trigger!,
    // DialogPopup spreads `FOCUSABLE_POPUP_PROPS` itself, so this only carries the dismiss
    // handlers.
    popupProps: dismiss.floating!,
  });

}
