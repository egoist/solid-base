import { createEffect, omit, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  FloatingFocusManager,
  type FocusTargetProp,
} from '../../utils/popups/focus/FloatingFocusManager';
import { createHoverPopupInteraction } from '../../utils/popups/interactions/hoverPopupInteraction';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { Side, Align } from '../../internals/anchorPositioning';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { createRenderedId } from '../../internals/resolveRenderedId';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import {
  MenuFilterImplContext,
  useMenuFilterImpl,
  type MenuFilterParentHandoff,
} from '../filter-root/MenuFilterContext';
import type { MenuInstantType } from '../store/MenuStore';
import type { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';

export interface MenuPopupPlainProps extends MenuPopup.Props {
  /** A filter root's own initial focus target; the plain default focuses the popup or its list. */
  initialFocus?: FocusTargetProp;
}

/**
 * Resolves the popup's `aria-labelledby`: the consumer's label, or the active trigger.
 */
export function resolvePopupLabel(
  props: { 'aria-label'?: unknown; 'aria-labelledby'?: unknown },
  activeTriggerElement: Element | null,
  activeTriggerId: string | null,
) {
  const ariaLabel = props['aria-label'] as string | undefined;
  let ariaLabelledBy = props['aria-labelledby'] as string | undefined;

  if (ariaLabelledBy == null && !ariaLabel) {
    // Prefer the element's live id over the registered one.
    ariaLabelledBy = activeTriggerElement
      ? activeTriggerElement.id || undefined
      : activeTriggerId || undefined;
  }

  return ariaLabelledBy;
}

const NO_PARENT_HANDOFF: MenuFilterParentHandoff = {
  parentVirtualFocusRef: undefined,
  handleFocus: undefined,
};

/**
 * The plain (unfiltered) implementation of `Menu.Popup`.
 * @internal
 */
export function MenuPopupPlain(componentProps: MenuPopupPlainProps): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'finalFocus',
    'id',
    'initialFocus',
  );

  const rootContext = useMenuRootContext();
  const { store, generatedPopupId, setRenderedPopupId, virtualFocus } = rootContext;
  const inheritedSubmenuRootContext = useMenuSubmenuRootContext();
  const positioner = useMenuPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;

  const open = () => store.select('open');
  const transitionStatus = () => store.select('transitionStatus');
  const mounted = () => store.select('mounted');
  const parent = () => store.select('parent');
  const activeTriggerElement = () => store.select('activeTriggerElement');
  const listElement = () => store.select('listElement');

  const [id, registerIdRef] = createRenderedId(
    componentProps,
    generatedPopupId,
    setRenderedPopupId,
  );

  // A dialog's menu can render under a submenu provider; only the actual submenu inherits it.
  const submenuRootContext = () =>
    parent().type === 'menu' ? inheritedSubmenuRootContext : undefined;
  const isContextMenu = () => parent().type === 'context-menu';

  const initialFocus = (): FocusTargetProp => {
    const initialFocusProp = componentProps.initialFocus;
    const currentParent = parent();
    if (initialFocusProp === undefined && listElement() && currentParent.type !== 'menu') {
      const list = listElement();
      return () => {
        // A keyboard or screen reader open highlights an item, which list navigation focuses.
        if (store.state.activeIndex !== null) {
          return false;
        }
        // The list holds the `menu` role, so a pointer open lands focus on it rather than on the
        // presentational popup.
        return list;
      };
    }
    return initialFocusProp ?? currentParent.type !== 'menu';
  };

  createOpenChangeComplete({
    open,
    element: () => store.select('popupElement'),
    onComplete() {
      if (store.state.open || store.state.openProp) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  createEffect(
    () => store.select('floatingTreeRoot') as FloatingTreeStore,
    (tree) => {
      function handleClose(event: {
        domEvent: Event | undefined;
        reason: MenuRoot.ChangeEventReason;
      }) {
        store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
      }

      tree.events.on('close', handleClose);
      return () => {
        tree.events.off('close', handleClose);
      };
    },
  );

  createHoverPopupInteraction(store, {
    get enabled() {
      const parentType = parent().type;
      return (
        store.select('hoverEnabled') &&
        !store.select('disabled') &&
        parentType !== 'context-menu' &&
        parentType !== 'menubar'
      );
    },
    closeDelay: () => store.select('closeDelay'),
  });

  // Only a menu under a filter root has a handoff to a filterable parent. Whether one is above is
  // fixed for a mounted popup.
  const useParentHandoff = useContext(MenuFilterImplContext)?.useParentHandoff;
  const { parentVirtualFocusRef, handleFocus } = useParentHandoff
    ? useParentHandoff(store as any, rootContext.parent, open, virtualFocus)
    : NO_PARENT_HANDOFF;

  const state: MenuPopup.State = {
    get transitionStatus() {
      return transitionStatus();
    },
    get side() {
      return positioner.side;
    },
    get align() {
      return positioner.align;
    },
    get open() {
      return open();
    },
    get nested() {
      return parent().type === 'menu';
    },
    get instant() {
      return store.select('instantType');
    },
  };

  const rootPopupProps = createDynamicPropsSource(() => store.select('popupProps'));

  const element = renderElement('div', componentProps, {
    state,
    ref: [
      (el: HTMLElement) => store.set('popupElement', el),
      registerIdRef,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
    props: [
      rootPopupProps,
      {
        get id() {
          return id();
        },
        // A rendered `Menu.List` carries the `menu` semantics instead.
        get role() {
          return listElement() ? 'presentation' : 'menu';
        },
        // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
        get 'aria-orientation'() {
          return !listElement() && rootContext.orientation === 'horizontal'
            ? 'horizontal'
            : undefined;
        },
        get 'aria-labelledby'() {
          if (listElement()) {
            return undefined;
          }
          return resolvePopupLabel(
            componentProps,
            activeTriggerElement(),
            store.select('activeTriggerId'),
          );
        },
        onKeyDown(event: KeyboardEvent) {
          submenuRootContext()?.onPopupKeyDown?.(event);
          if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        // React's `onFocus` bubbles: focus landing on an item inside the popup counts.
        onFocusIn: handleFocus,
      } as HTMLProps,
      createDynamicPropsSource(() => getDisabledMountTransitionStyles(transitionStatus())),
      elementProps,
      {
        get 'data-rootownerid'() {
          return store.select('rootId');
        },
      },
    ],
  });

  const returnFocus = (): FocusTargetProp => {
    const finalFocus = componentProps.finalFocus;
    if (finalFocus !== undefined) {
      return finalFocus;
    }
    // Internal defaults rather than consumer targets, so focus that already moved is respected.
    const dynamicReturnFocus = submenuRootContext()?.getReturnElement ?? parentVirtualFocusRef;
    if (dynamicReturnFocus) {
      return dynamicReturnFocus as FocusTargetProp;
    }
    const currentParent = parent();
    if (
      activeTriggerElement() ||
      (currentParent.type === 'menubar' &&
        store.select('lastOpenChangeReason') !== REASONS.outsidePress)
    ) {
      return true;
    }
    return currentParent.type === undefined || currentParent.type === 'context-menu';
  };

  const explicitReturnFocus = () =>
    componentProps.finalFocus === undefined &&
    (submenuRootContext()?.getReturnElement ?? parentVirtualFocusRef)
      ? false
      : undefined;

  // The focus manager resolves `returnFocus` once the popup unmounts, when `activeTriggerElement`
  // already reads `null`. Upstream reads the value of the last render while mounted: keep it.
  let mountedReturnFocus: { value: FocusTargetProp; explicit: boolean | undefined } | undefined;
  createEffect(
    () => (mounted() ? { value: returnFocus(), explicit: explicitReturnFocus() } : undefined),
    (latest) => {
      if (latest) {
        mountedReturnFocus = latest;
      }
    },
  );
  const resolvedReturnFocus = () =>
    mounted() || !mountedReturnFocus ? returnFocus() : mountedReturnFocus.value;
  const resolvedExplicitReturnFocus = () =>
    mounted() || !mountedReturnFocus ? explicitReturnFocus() : mountedReturnFocus.explicit;

  return (
    <FloatingFocusManager
      store={store}
      openInteractionType={store.select('openMethod')}
      modal={isContextMenu()}
      disabled={!mounted()}
      returnFocus={resolvedReturnFocus()}
      explicitReturnFocus={resolvedExplicitReturnFocus()}
      initialFocus={initialFocus()}
      restoreFocus
      getInsideElements={
        parent().type === undefined
          ? () => [store.context.beforeTriggerFocusGuardRef.current]
          : undefined
      }
      externalTree={
        rootContext.parent.type !== 'menubar'
          ? (store.select('floatingTreeRoot') as FloatingTreeStore)
          : undefined
      }
      previousFocusableElement={activeTriggerElement() as HTMLElement | null}
      nextFocusableElement={
        parent().type === undefined ? store.context.triggerFocusTargetRef : undefined
      }
      beforeContentFocusGuardRef={(el: HTMLSpanElement) => {
        store.context.beforeContentFocusGuardRef.current = el;
      }}
    >
      {element}
    </FloatingFocusManager>
  );
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuPopup(props: MenuPopup.Props): JSX.Element {
  const impl = useMenuFilterImpl();
  if (impl) {
    const Popup = impl.Popup;
    return <Popup {...props} />;
  }
  return <MenuPopupPlain {...props} />;
}

export interface MenuPopupProps extends BaseUIComponentProps<'div', MenuPopupState> {
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Determines the element to focus when the menu is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusTargetProp;
}

export interface MenuPopupState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: MenuInstantType;
}

export namespace MenuPopup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}
