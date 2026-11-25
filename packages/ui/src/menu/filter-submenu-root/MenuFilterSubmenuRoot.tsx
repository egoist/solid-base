import { createEffect, merge, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@egoist/solid-base-utils/owner';
import { activeElement, contains } from '@egoist/solid-base-utils/shadowDom';
import { isHTMLElement } from '@floating-ui/utils/dom';
import type { MenuSubmenuRoot, MenuSubmenuRootProps } from '../submenu-root/MenuSubmenuRoot';
import { MenuRootInternal } from '../root/MenuRoot';
import type { MenuRoot } from '../root/MenuRoot';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuFilterDropdown } from '../filter-root/MenuFilterDropdown';
import { isKeyboardOpen } from '../utils/isKeyboardOpen';
import { splitMenuFilterRootProps } from '../filter-root/useMenuFilterRoot';
import type { BaseUIEvent } from '../../internals/types';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from '../../utils/popups/interactions/listNavigation';
import { stopEvent } from '../../utils/popups/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { moveHighlightFrom } from '../filter-root/moveHighlightFrom';
import { MenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import type { MenuStore } from '../store/MenuStore';
import type { MenuRootContext } from '../root/MenuRootContext';

type ParentReference = { reference: HTMLElement; trigger: HTMLElement };

/**
 * The filterable implementation of `Menu.SubmenuRoot`, rendered in its place when the submenu
 * root sits inside `Menu.FilterProvider`.
 *
 * @internal
 */
export function MenuFilterSubmenuRoot(props: MenuFilterSubmenuRootProps): JSX.Element {
  const parent = useMenuRootContext();
  const parentStore = parent.store;

  const { rootProps, dropdownProps } = splitMenuFilterRootProps(props);

  let parentReference: ParentReference | null = null;

  function handleSubmenuEnter(trigger: HTMLElement, event: KeyboardEvent | undefined) {
    const focusedElement = parent.virtualFocus
      ? parentStore.context.virtualFocusRef?.current
      : activeElement(ownerDocument(trigger));

    if (isHTMLElement(focusedElement)) {
      parentReference = { reference: focusedElement, trigger };
      parentStore.setActiveIndex(null, event ? REASONS.keyboard : REASONS.none, event);
    }
  }

  function highlightTrigger(trigger: HTMLElement, event: Event | undefined) {
    parentStore.highlightItem(trigger, REASONS.keyboard, event);
  }

  function handleSubmenuExit(event: KeyboardEvent) {
    if (!parentReference) {
      return;
    }

    parentReference.reference.focus({ preventScroll: true });
    highlightTrigger(parentReference.trigger, event);
  }

  function handleOpenChange(nextOpen: boolean, details: MenuSubmenuRoot.ChangeEventDetails) {
    // Callbacks are read when called, which can happen in an effect's apply phase.
    untrack(() => props.onOpenChange)?.(nextOpen, details);
    if (details.isCanceled) {
      return;
    }

    if (!nextOpen) {
      if (details.reason === REASONS.escapeKey && isHTMLElement(details.trigger)) {
        highlightTrigger(details.trigger, details.event);
        // `MenuPopup` returns focus through `getReturnElement`, so point it at the element that
        // can hold real focus: the parent's input, not its untabbable trigger.
        parentReference = {
          reference: parent.virtualFocus
            ? (parentStore.context.virtualFocusRef?.current ?? details.trigger)
            : details.trigger,
          trigger: details.trigger,
        };
      }
      return;
    }

    parentReference = null;
    if (isHTMLElement(details.trigger) && isKeyboardOpen(details.reason, details.event)) {
      // A keyboard click reports its click, which isn't the key that opened the submenu.
      handleSubmenuEnter(
        details.trigger,
        details.reason === REASONS.listNavigation ? (details.event as KeyboardEvent) : undefined,
      );
    }
  }

  const internalProps = merge(rootProps, {
    isSubmenu: true,
    get disabled() {
      return parentStore.select('disabled') || props.disabled;
    },
    onOpenChange: handleOpenChange,
  }) as MenuRoot.Props & { isSubmenu: boolean };

  const getReturnElement = () =>
    parentReference?.reference ??
    (parent.virtualFocus ? parentStore.context.virtualFocusRef?.current : null) ??
    null;

  return (
    <MenuRootInternal {...internalProps}>
      <MenuFilterSubmenuNavigation
        parent={parent}
        getReturnElement={getReturnElement}
        onSubmenuEnter={handleSubmenuEnter}
        onSubmenuExit={handleSubmenuExit}
      >
        <MenuFilterDropdown {...dropdownProps}>{props.children}</MenuFilterDropdown>
      </MenuFilterSubmenuNavigation>
    </MenuRootInternal>
  );
}

interface MenuFilterSubmenuNavigationProps {
  children?: JSX.Element;
  /** The parent menu's root context. Read once. */
  parent: MenuRootContext;
  onSubmenuEnter(trigger: HTMLElement, event: KeyboardEvent): void;
  onSubmenuExit(event: KeyboardEvent): void;
  getReturnElement(): HTMLElement | null;
}

function MenuFilterSubmenuNavigation(props: MenuFilterSubmenuNavigationProps): JSX.Element {
  const parent = untrack(() => props.parent);
  const parentStore = parent.store as MenuStore<unknown>;
  const onSubmenuEnter = untrack(() => props.onSubmenuEnter);
  const onSubmenuExit = untrack(() => props.onSubmenuExit);
  const getReturnElement = untrack(() => props.getReturnElement);

  const rootContext = useMenuRootContext();
  const { store } = rootContext;
  const direction = useDirection();

  let wasMounted = false;

  function handleReturnFocus() {
    // A plain parent has no input to return to. Focus the trigger this submenu opened from, as a
    // plain submenu does, so a hover close doesn't strand focus on the body.
    const [ownTrigger] = store.context.triggerElements.elements();
    return getReturnElement() ?? (isHTMLElement(ownTrigger) ? ownTrigger : null);
  }

  // A hover close makes the focus manager skip its return focus, which would strand the
  // submenu input's focus on the body once the popup unmounts.
  createEffect(
    () => store.select('mounted'),
    (mounted) => {
      const previouslyMounted = wasMounted;
      wasMounted = mounted;
      if (mounted || !previouslyMounted) {
        return;
      }

      const returnElement = handleReturnFocus();
      if (!returnElement || !parentStore.state.open) {
        return;
      }
      const doc = ownerDocument(returnElement);
      const activeEl = activeElement(doc);
      if (
        activeEl === doc.body ||
        activeEl == null ||
        contains(store.state.popupElement, activeEl)
      ) {
        returnElement.focus({ preventScroll: true });
      }
    },
  );

  function moveInParent(from: HTMLElement, event: KeyboardEvent) {
    const item = moveHighlightFrom(parentStore, from, event, {
      orientation: parent.orientation,
      rtl: direction() === 'rtl',
      loopFocus: parent.loopFocus,
      allowEscape: parent.virtualFocus && parent.allowEscape,
    });
    if (!parent.virtualFocus) {
      item?.focus({ preventScroll: true });
    }
  }

  function close(event: KeyboardEvent) {
    if (!store.state.open) {
      return;
    }

    // The key can reach this popup re-dispatched on its highlighted item, so it can't be left to
    // bubble to the parent. A close key that also navigates the parent moves it from here.
    stopEvent(event);
    const trigger = store.state.activeTriggerElement;

    const eventDetails = createChangeEventDetails(REASONS.listNavigation, event);
    store.setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      onSubmenuExit(event);
    }

    // `onSubmenuExit` bails when the submenu was opened by pointer, so return focus here.
    const returnElement = getReturnElement() ?? store.state.activeTriggerElement;
    if (
      !store.state.open &&
      isHTMLElement(returnElement) &&
      activeElement(ownerDocument(returnElement)) !== returnElement
    ) {
      returnElement.focus();
    }

    if (
      !store.state.open &&
      isHTMLElement(trigger) &&
      isMainOrientationKey(event.key, parent.orientation)
    ) {
      moveInParent(trigger, event);
    }
  }

  function handleTriggerKeyDown(event: BaseUIEvent<KeyboardEvent>) {
    const currentTarget = event.currentTarget as HTMLElement;
    if (isMainOrientationKey(event.key, parent.orientation)) {
      moveInParent(currentTarget, event);
      event.preventBaseUIHandler();
      stopEvent(event);
      return;
    }

    const open = store.state.open;
    const isRtl = direction() === 'rtl';
    const isCloseKey = isCrossOrientationCloseKey(event.key, rootContext.orientation, isRtl, false);

    if (open && isCloseKey) {
      close(event);
      return;
    }

    const isOpenKey = isCrossOrientationOpenKey(event.key, parent.orientation, isRtl);
    if (!isOpenKey) {
      return;
    }

    stopEvent(event);

    if (open) {
      // Re-entering an already-open submenu hands the cursor to its own focus owner. The submenu
      // is always virtually focused, so there is no roving-focus branch here. The highlight is
      // kept, so an automatic highlight or an earlier keyboard position survives re-entry.
      onSubmenuEnter(currentTarget, event);
      store.context.virtualFocusRef?.current?.focus({ preventScroll: true });
      return;
    }

    store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, currentTarget));
  }

  function handlePopupKeyDown(event: KeyboardEvent) {
    // A key that composes text in the input must not close the submenu.
    if (event.which === 229) {
      return;
    }
    const isCloseKey = isCrossOrientationCloseKey(
      event.key,
      rootContext.orientation,
      direction() === 'rtl',
      false,
    );
    if (isCloseKey) {
      close(event);
    }
  }

  const contextValue: MenuSubmenuRootContext = {
    getReturnElement: handleReturnFocus,
    onTriggerKeyDown: handleTriggerKeyDown,
    onPopupKeyDown: handlePopupKeyDown,
  };

  return <MenuSubmenuRootContext value={contextValue}>{props.children}</MenuSubmenuRootContext>;
}

export type MenuFilterSubmenuRootProps = MenuSubmenuRootProps & MenuFilterProviderOptions;
