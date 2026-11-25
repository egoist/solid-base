import { createEffect, type Accessor } from 'solid-js';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { activeElement, contains } from '@egoist/solid-base-utils/shadowDom';
import type { MenuParent, MenuRoot } from '../root/MenuRoot';
import type { MenuStore } from '../store/MenuStore';
import { REASONS } from '../../internals/reasons';
import type { MenuFilterParentHandoff } from './MenuFilterContext';

/**
 * A plain submenu whose parent is filterable. The parent keeps real focus on its input, so its
 * trigger never blurs and its return focus waits for this popup's exit animation. The submenu
 * hands focus and the parent's highlight back itself.
 */
export function createVirtualFocusParentHandoff(
  store: MenuStore<unknown>,
  parent: MenuParent,
  open: Accessor<boolean>,
  virtualFocus: boolean,
): MenuFilterParentHandoff {
  const parentStore = parent.type === 'menu' ? parent.store : null;
  const parentVirtualFocusRef = parentStore?.context.virtualFocusRef;

  function returnToParent(trigger: Element | null, reason: MenuRoot.ChangeEventReason | null) {
    const focusOwner = parentVirtualFocusRef?.current;
    if (virtualFocus || store.state.open || !parentStore?.state.open || !focusOwner) {
      return;
    }

    if (contains(store.state.popupElement, activeElement(ownerDocument(focusOwner)))) {
      focusOwner.focus({ preventScroll: true });
    }

    if (
      (reason === REASONS.listNavigation || reason === REASONS.escapeKey) &&
      parentStore.state.activeIndex == null
    ) {
      // The closing key is gone by this microtask, so there is no event to report it with.
      parentStore.highlightItem(trigger, REASONS.none);
    }
  }

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      // Read the trigger now: an unmount can clear it by the time the parent settles.
      const trigger = store.state.activeTriggerElement;
      const reason = store.state.openChangeReason;
      queueMicrotask(() => returnToParent(trigger, reason));
    }
  });

  // Real focus entering this submenu is when a plain parent's trigger would blur: the parent has
  // no active item until a keyboard close hands the cursor back to the trigger.
  function handleFocus() {
    if (!virtualFocus && parentVirtualFocusRef && parentStore?.state.activeIndex != null) {
      parentStore.setActiveIndex(null, REASONS.none);
    }
  }

  return { parentVirtualFocusRef, handleFocus };
}
