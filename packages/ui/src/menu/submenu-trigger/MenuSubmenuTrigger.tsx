import { createEffect, createSignal, omit } from 'solid-js';
import { isDev, type JSX } from '@solidjs/web';
import { isElementDisabled } from '@egoist/solid-base-utils/isElementDisabled';
import { warn } from '@egoist/solid-base-utils/warn';
import { platform } from '@egoist/solid-base-utils/platform';
import { getTarget } from '@egoist/solid-base-utils/shadowDom';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { createClick } from '../../utils/popups/interactions/click';
import { createHoverTriggerInteraction } from '../../utils/popups/interactions/hoverTriggerInteraction';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { useMenuRootContext } from '../root/MenuRootContext';
import { createBaseUiId } from '../../internals/baseUiId';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import { createMenuItem, type MenuItemMetadata } from '../item/createMenuItem';
import { renderElement } from '../../internals/renderElement';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import {
  createDynamicPropsSource,
  createTriggerDataForwarding,
} from '../../utils/popups/popupStoreUtils';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { REASONS } from '../../internals/reasons';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { State as MenuStoreState } from '../store/MenuStore';
import type { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import { renderFilteredItem } from '../item/filteredItem';

function MenuSubmenuTriggerPlain(componentProps: MenuSubmenuTrigger.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'label',
    'id',
    'nativeButton',
    'openOnHover',
    'delay',
    'closeDelay',
    'disabled',
  );

  const context = useMenuRootContext(true);
  if (context?.parent.type !== 'menu') {
    throw new Error('Base UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.');
  }

  const menuPositionerContext = useMenuPositionerContext(true);
  const submenuRootContext = useMenuSubmenuRootContext();

  const { store, parentVirtualFocus } = context;
  const parentMenuStore = context.parent.store;

  const listItem = useCompositeListItem({ label: () => componentProps.label });
  const thisTriggerId = createBaseUiId(() => componentProps.id);

  const open = () => store.select('open');
  const closeDelay = () => componentProps.closeDelay ?? 0;
  const delay = () => componentProps.delay ?? 100;
  const openOnHover = () => componentProps.openOnHover ?? true;

  let focusReturnedThroughGuard = false;
  let triggerElement: HTMLElement | null = null;
  // Reactive copy for the hover interaction, which attaches its listeners to the trigger.
  const [hoverTriggerElement, setHoverTriggerElement] = createSignal<HTMLElement | null>(null);

  const { registerTrigger } = createTriggerDataForwarding<MenuStoreState<unknown>>(
    thisTriggerId,
    () => store,
    () => ({ closeDelay: closeDelay() }),
  );

  createEffect(
    () => [open(), store.select('positionerElement')] as const,
    ([isOpen, positionerElement]) => {
      if (!isOpen || !positionerElement) {
        return undefined;
      }

      function handleGuardFocusOut(event: FocusEvent) {
        if (getTarget(event) === store.context.beforeContentFocusGuardRef.current) {
          focusReturnedThroughGuard = event.relatedTarget === triggerElement;
        }
      }

      // Observe focus leaving the guard inside its positioner. When the portal is in a shadow
      // root, the trigger's focus event can report the shadow host as `relatedTarget`, not the
      // guard.
      positionerElement.addEventListener('focusout', handleGuardFocusOut, true);
      return () => {
        focusReturnedThroughGuard = false;
        positionerElement.removeEventListener('focusout', handleGuardFocusOut, true);
      };
    },
  );

  store.syncValue('closeDelay', closeDelay);

  const disabled = () =>
    (componentProps.disabled ?? false) ||
    store.select('disabled') ||
    parentMenuStore.select('disabled');

  if (isDev) {
    createEffect(disabled, (isDisabled) => {
      if (triggerElement && isElementDisabled(triggerElement) && !isDisabled) {
        warn(
          'A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
        );
      }
    });
  }

  const highlighted = () => parentMenuStore.select('isActive', listItem.index());

  const itemMetadata: MenuItemMetadata = {
    type: 'submenu-trigger',
    setActive(event: MouseEvent) {
      if (parentMenuStore.select('highlightItemOnHover')) {
        parentMenuStore.setActiveIndex(listItem.index(), REASONS.pointer, event);
      }
    },
  };

  const { getItemProps, itemRef } = createMenuItem({
    closeOnClick: false,
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return thisTriggerId();
    },
    store,
    typingRef: parentMenuStore.context.typingRef,
    get nativeButton() {
      return componentProps.nativeButton ?? false;
    },
    itemMetadata,
    get nodeId() {
      return menuPositionerContext?.context.nodeId;
    },
  });

  const hoverProps = createHoverTriggerInteraction(store, {
    get enabled() {
      return store.select('hoverEnabled') && openOnHover() && !disabled();
    },
    handleClose: safePolygon({ blockPointerEvents: true }),
    mouseOnly: true,
    move: true,
    restMs: () => delay(),
    delay: () => ({ open: delay(), close: closeDelay() }),
    shouldOpen: () => (delay() > 0 ? parentMenuStore.select('allowMouseEnter') : true),
    get triggerElement() {
      return hoverTriggerElement();
    },
    externalTree: store.select('floatingTreeRoot') as FloatingTreeStore,
    // Chrome can drop the trigger's `mouseleave` during a fast pointer sweep,
    // leaving a stale submenu open (see #5152) — cancel from `mouseout` too.
    guardStaleOpen: true,
  });

  const click = createClick(store, {
    get enabled() {
      return !disabled();
    },
    event: 'mousedown',
    // Without toggling, TalkBack users cannot close the submenu to reach the next parent menu
    // item. Toggling applies to touch and keyboard activation. In hover mode, mouse presses are
    // ignored and the first activation after hover-opening keeps the submenu open.
    toggle: true,
    get ignoreMouse() {
      return openOnHover();
    },
    stickIfOpen: () => openOnHover(),
  });

  // The root's trigger props (they carry no `id`: the trigger renders its own).
  const rootTriggerProps = createDynamicPropsSource(
    () => store.select('triggerProps', true) as HTMLProps,
  );

  const state: MenuSubmenuTrigger.State = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get open() {
      return open();
    },
  };

  // Arrow keys open the submenu through list navigation without dispatching a click, so
  // `openMethod` stays null there; Enter and Space do dispatch one and report `keyboard`.
  const shouldOmitExpanded = () => {
    const openedByKeyboard =
      store.select('lastOpenChangeReason') === REASONS.listNavigation ||
      store.select('openMethod') === 'keyboard';
    return open() && openedByKeyboard && platform.screenReader.voiceOver;
  };

  const voiceOverExpandedProps = createDynamicPropsSource(() =>
    shouldOmitExpanded() ? { 'aria-expanded': undefined } : undefined,
  );

  return renderElement('div', componentProps, {
    state,
    stateAttributesMapping: triggerOpenStateMapping,
    props: [
      click.reference,
      hoverProps,
      rootTriggerProps,
      // The filter's submenu root overrides the generic trigger handler because entry and exit
      // depend on both the parent and child menu orientations.
      submenuRootContext?.onTriggerKeyDown
        ? { onKeyDown: submenuRootContext.onTriggerKeyDown }
        : undefined,
      createDynamicPropsSource(() => parentMenuStore.select('itemProps')),
      // Opening a submenu changes the trigger's expanded state while the trigger still holds
      // focus, and VoiceOver announces that state change instead of the submenu item that focus
      // moves to a moment later. Dropping the state while the submenu is open avoids the
      // announcement; `aria-haspopup` still conveys that the item opens a submenu.
      voiceOverExpandedProps,
      {
        get 'aria-controls'() {
          return store.select('triggerPopupId', thisTriggerId());
        },
        // A virtually focused parent keeps real focus on its input, so the trigger must stay out
        // of the tab order.
        get tabindex() {
          return parentVirtualFocus || !(open() || highlighted()) ? -1 : 0;
        },
        onFocus(event: FocusEvent) {
          // Close when focus returns through the submenu's guard to its trigger. This also lets
          // screen reader users move past the trigger in the parent menu. Direct focus from a
          // submenu item, such as on hover, leaves the submenu open.
          if (store.select('open') && focusReturnedThroughGuard) {
            focusReturnedThroughGuard = false;
            store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
          }
        },
        onBlur() {
          if (parentMenuStore.state.activeIndex === listItem.index() && listItem.index() !== -1) {
            parentMenuStore.setActiveIndex(null, REASONS.none);
          }
        },
      },
      elementProps,
      // `getItemProps` stays last so the button keeps gating consumer handlers while disabled.
      getItemProps,
    ],
    ref: [
      listItem.ref,
      itemRef,
      registerTrigger,
      (el: HTMLElement) => {
        triggerElement = el;
        setHoverTriggerElement(el);
        store.set('activeTriggerElement', el);
      },
    ],
  });
}

/**
 * A menu item that opens a submenu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuTrigger(props: MenuSubmenuTrigger.Props): JSX.Element {
  return renderFilteredItem(props, MenuSubmenuTriggerPlain, 'submenu-trigger');
}

export interface MenuSubmenuTriggerState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
}

export interface MenuSubmenuTriggerProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', MenuSubmenuTriggerState>, 'id'> {
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   * @default true
   */
  openOnHover?: boolean | undefined;
}

export namespace MenuSubmenuTrigger {
  export type Props = MenuSubmenuTriggerProps;
  export type State = MenuSubmenuTriggerState;
}
