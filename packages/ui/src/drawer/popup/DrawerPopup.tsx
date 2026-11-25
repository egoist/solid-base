import { createEffect, createMemo, createSignal, omit, onSettled, untrack } from 'solid-js';
import { isDev, type JSX } from '@solidjs/web';
import { error } from '@egoist/solid-base-utils/error';
import {
  FloatingFocusManager,
  type FocusTargetProp,
} from '../../utils/popups/focus/FloatingFocusManager';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from './DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from './DrawerPopupDataAttributes';
import { useDialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import type { DrawerSwipeDirection } from '../root/DrawerRootContext';
import { createDrawerSnapPoints, getSnapPointSwipeMovement } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';
import {
  FOCUSABLE_POPUP_PROPS,
  createDynamicPropsSource,
} from '../../utils/popups/popupStoreUtils';

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: '0',
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: '1',
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<number>',
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopupState> = {
  ...popupTransitionStateMapping,
  expanded(value) {
    return value ? { [DrawerPopupDataAttributes.expanded]: '' } : null;
  },
  nestedDrawerOpen(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerOpen]: '' } : null;
  },
  nestedDrawerSwiping(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerSwiping]: '' } : null;
  },
  swipeDirection(value) {
    return { [DrawerPopupDataAttributes.swipeDirection]: value };
  },
  swiping(value) {
    return value ? { [DrawerPopupDataAttributes.swiping]: '' } : null;
  },
};

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerPopup(componentProps: DrawerPopup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'finalFocus',
    'initialFocus',
    'id',
  );

  const store = useDialogRootContext();
  const drawer = useDrawerRootContext();

  const swipe = useDrawerViewportContext();
  useDialogPortalContext();
  const snap = createDrawerSnapPoints();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');
  const transitionStatus = () => store.select('transitionStatus');
  const nestedOpenDrawerCount = () => store.select('nestedOpenDrawerCount');
  const nestedDrawerOpen = () => nestedOpenDrawerCount() > 0;
  const swiping = () => swipe?.swiping ?? false;

  const [popupHeight, setPopupHeight] = createSignal(0);
  let popupHeightValue = 0;

  if (isDev && !swipe) {
    onSettled(() => {
      error(
        '<Drawer.Popup> expected to be rendered within <Drawer.Viewport>. Omitting the ' +
          'viewport disables drawer swipe handling and touch scroll locking. Wrap ' +
          '<Drawer.Popup> in <Drawer.Viewport>.',
      );
    });
  }

  const measureHeight = () => {
    const popupElement = store.state.popupElement;
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;
    const { frontmostHeight, hasNestedDrawer } = untrack(() => ({
      frontmostHeight: drawer.frontmostHeight,
      hasNestedDrawer: drawer.hasNestedDrawer,
    }));

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (
      popupHeightValue > 0 &&
      frontmostHeight > popupHeightValue &&
      offsetHeight > popupHeightValue
    ) {
      return;
    }

    const keepHeightWhileNested = popupHeightValue > 0 && hasNestedDrawer;
    if (keepHeightWhileNested) {
      const oldHeight = popupHeightValue;
      setPopupHeight(oldHeight);
      drawer.onPopupHeightChange(oldHeight);
      return;
    }

    const nextHeight = offsetHeight;
    if (nextHeight === popupHeightValue) {
      return;
    }

    popupHeightValue = nextHeight;
    setPopupHeight(nextHeight);
    drawer.onPopupHeightChange(nextHeight);
  };

  createEffect(
    () => [mounted(), nestedDrawerOpen(), store.select('popupElement')] as const,
    ([isMounted, , popupElement]) => {
      if (!isMounted) {
        popupHeightValue = 0;
        setPopupHeight(0);
        drawer.onPopupHeightChange(0);
        return undefined;
      }

      if (!popupElement) {
        return undefined;
      }

      removeCSSVariableInheritance();
      measureHeight();

      if (typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureHeight);

      resizeObserver.observe(popupElement);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  createEffect(
    () => store.select('popupElement'),
    (popupElement) => {
      if (!popupElement) {
        return undefined;
      }

      const nestedSwipeProgressStore = drawer.nestedSwipeProgressStore;
      const syncNestedSwipeProgress = () => {
        const progress = nestedSwipeProgressStore.getSnapshot();
        if (progress > 0) {
          popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
        } else {
          popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
        }
      };

      syncNestedSwipeProgress();
      const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);

      return () => {
        unsubscribe();
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      };
    },
  );

  const notifyParentFrontmostHeight = drawer.notifyParentFrontmostHeight;
  if (notifyParentFrontmostHeight) {
    createEffect(
      () => [open(), drawer.frontmostHeight] as const,
      ([isOpen, frontmostHeight]) => {
        if (!isOpen) {
          return undefined;
        }

        notifyParentFrontmostHeight(frontmostHeight);

        return () => {
          notifyParentFrontmostHeight(0);
        };
      },
    );
  }

  const notifyParentHasNestedDrawer = drawer.notifyParentHasNestedDrawer;
  if (notifyParentHasNestedDrawer) {
    const present = createMemo(() => open() || transitionStatus() === 'ending');
    createEffect(present, (isPresent) => {
      notifyParentHasNestedDrawer(isPresent);

      return () => {
        notifyParentHasNestedDrawer(false);
      };
    });
  }

  createOpenChangeComplete({
    open,
    element: () => store.select('popupElement'),
    onComplete() {
      if (store.state.openProp ?? store.state.open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const popupElementRef = {
    get current() {
      return store.state.popupElement;
    },
  };

  const rootPopupProps = createDynamicPropsSource(() => store.select('popupProps'));

  const state: DrawerPopup.State = {
    get open() {
      return open();
    },
    get nested() {
      return store.select('nested');
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get expanded() {
      return snap.activeSnapPoint === 1;
    },
    get nestedDrawerOpen() {
      return nestedDrawerOpen();
    },
    get nestedDrawerSwiping() {
      return drawer.nestedSwiping;
    },
    get swipeDirection() {
      return drawer.swipeDirection;
    },
    get swiping() {
      return swiping();
    },
  };

  function getStyle(): JSX.CSSProperties {
    const swipeDirection = drawer.swipeDirection;
    const snapPoints = snap.snapPoints;
    const activeSnapPointOffset = snap.activeSnapPointOffset;
    const frontmostHeight = drawer.frontmostHeight;
    const height = popupHeight();
    const swipeStrength = swipe?.swipeStrength ?? null;

    let popupHeightCssVarValue: string | undefined;
    const shouldUseAutoHeight = !drawer.hasNestedDrawer && transitionStatus() !== 'ending';
    if (height && !shouldUseAutoHeight) {
      popupHeightCssVarValue = `${height}px`;
    }

    const shouldApplySnapPoints =
      snapPoints && snapPoints.length > 0 && (swipeDirection === 'down' || swipeDirection === 'up');
    let snapPointOffsetValue: number | null = null;
    if (shouldApplySnapPoints && activeSnapPointOffset !== null) {
      snapPointOffsetValue =
        swipeDirection === 'up' ? -activeSnapPointOffset : activeSnapPointOffset;
    }

    let dragStyles: Record<string, string | undefined> = swipe
      ? (swipe.getDragStyles() as Record<string, string | undefined>)
      : {};
    if (shouldApplySnapPoints && swipeDirection === 'down') {
      const baseOffset = activeSnapPointOffset ?? 0;
      const movementValue = Number.parseFloat(
        String(dragStyles[DrawerPopupCssVars.swipeMovementY]),
      );

      if (swiping() && Number.isFinite(movementValue)) {
        dragStyles = {
          ...dragStyles,
          transform: undefined,
          [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(
            baseOffset,
            movementValue,
          )}px`,
        };
      } else {
        dragStyles = {
          ...dragStyles,
          transform: undefined,
        };
      }
    }

    return {
      ...dragStyles,
      [DrawerBackdropCssVars.swipeProgress]: '0',
      [DrawerPopupCssVars.nestedDrawers]: String(nestedOpenDrawerCount()),
      [DrawerPopupCssVars.height]: popupHeightCssVarValue,
      [DrawerPopupCssVars.snapPointOffset]:
        typeof snapPointOffsetValue === 'number' ? `${snapPointOffsetValue}px` : '0px',
      [DrawerPopupCssVars.frontmostHeight]: frontmostHeight ? `${frontmostHeight}px` : undefined,
      [DrawerPopupCssVars.swipeStrength]:
        typeof swipeStrength === 'number' && Number.isFinite(swipeStrength) && swipeStrength > 0
          ? `${swipeStrength}`
          : '1',
    } as JSX.CSSProperties;
  }

  const element = renderElement('div', componentProps, {
    state,
    props: [
      rootPopupProps,
      {
        get id() {
          return componentProps.id ?? store.select('defaultPopupId');
        },
        get 'aria-labelledby'() {
          return store.select('titleElementId');
        },
        get 'aria-describedby'() {
          return store.select('descriptionElementId');
        },
        get role() {
          return store.select('role');
        },
        ...FOCUSABLE_POPUP_PROPS,
        get hidden() {
          return !mounted();
        },
        onKeyDown(event: KeyboardEvent) {
          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        get style() {
          return getStyle();
        },
      },
      elementProps,
    ],
    ref: (el: HTMLElement) => store.set('popupElement', el),
    stateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      store={store}
      openInteractionType={store.select('openMethod')}
      disabled={!mounted()}
      closeOnFocusOut={!store.select('disablePointerDismissal')}
      initialFocus={
        componentProps.initialFocus === undefined ? popupElementRef : componentProps.initialFocus
      }
      returnFocus={componentProps.finalFocus}
      modal={store.select('modal') !== false}
      restoreFocus="popup"
    >
      {element}
    </FloatingFocusManager>
  );
}

export interface DrawerPopupProps extends BaseUIComponentProps<'div', DrawerPopupState> {
  /**
   * Determines the element to focus when the drawer is opened.
   * By default, the popup itself is focused.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: FocusTargetProp;
  /**
   * Determines the element to focus when the drawer is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element or a ref object (`{ current }`): Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusTargetProp;
}

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer is nested within a parent drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

export namespace DrawerPopup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}
