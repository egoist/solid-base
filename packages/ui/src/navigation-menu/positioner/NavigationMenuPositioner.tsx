import { createEffect, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@egoist/solid-base-utils/addEventListener';
import { mergeCleanups } from '@egoist/solid-base-utils/mergeCleanups';
import { ownerWindow } from '@egoist/solid-base-utils/owner';
import { createTimeout } from '@egoist/solid-base-utils/timeout';
import {
  disableFocusInside,
  enableFocusInside,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuPortalContext } from '../portal/NavigationMenuPortalContext';
import type {
  Align,
  Side,
  CreateAnchorPositioningSharedParameters,
} from '../../internals/anchorPositioning';
import { createAnchorPositioning } from '../../internals/anchorPositioning';
import { createFloatingRootStore } from '../../utils/popups/floating-root/createFloatingRootStore';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import type { PositioningInteractionStore } from '../../utils/popups/types';
import { NavigationMenuPositionerContext } from './NavigationMenuPositionerContext';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { adaptiveOrigin } from '../../utils/popups/positioning/adaptiveOriginMiddleware';
import { renderPositioner } from '../../utils/popups/positioning/positioner';

/**
 * A positioning store that forwards to whichever store `accessor` returns: the active trigger's
 * store, which is only known once an item opens, or a fallback.
 */
function createFloatingRootStoreProxy(
  accessor: () => FloatingRootStore,
): PositioningInteractionStore {
  return {
    select: ((key: any) => (accessor().select as any)(key)) as any,
    set: ((key: any, value: any) => (untrack(accessor) as any).set(key, value)) as any,
    setOpen: (open, details) => untrack(accessor).setOpen(open, details),
    clearPositioning: () => untrack(accessor).clearPositioning(),
    get context() {
      return untrack(accessor).context;
    },
  };
}

/**
 * Positions the navigation menu against the currently active trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Navigation Menu](https://base.egoist.dev/components/navigation-menu)
 */
export function NavigationMenuPositioner(
  componentProps: NavigationMenuPositioner.Props,
): JSX.Element {
  const context = useNavigationMenuRootContext();

  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'anchor',
    'positionMethod',
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionBoundary',
    'collisionPadding',
    'collisionAvoidance',
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
  ) as HTMLProps;

  const keepMounted = useNavigationMenuPortalContext();
  const nodeId = useNavigationMenuTreeContext();

  const initialInstantTimeout = createTimeout();
  const resizeTimeout = createTimeout();

  // When the menu is initially open, disable the positioner's transition for one frame
  // so a default value does not animate in from the unpositioned portal state.
  const initiallyOpen = untrack(() => context.open);
  const [instant, setInstant] = createSignal(initiallyOpen);
  let needsInitialInstantReset = initiallyOpen;

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  createEffect(
    () => context.positionerElement,
    (positionerElement) => {
      if (!positionerElement) {
        return undefined;
      }

      // Make sure elements inside the portal element are tabbable only when the
      // portal has already been focused, either by tabbing into a focus trap
      // element outside or using the mouse.
      function onFocus(event: FocusEvent) {
        if (positionerElement && isOutsideEvent(event)) {
          const focusing = event.type === 'focusin';
          const manageFocus = focusing ? enableFocusInside : disableFocusInside;
          manageFocus(positionerElement);
        }
      }

      // Listen to the event on the capture phase so they run before the focus
      // trap elements onFocus prop is called.
      return mergeCleanups(
        addEventListener(positionerElement, 'focusin', onFocus, true),
        addEventListener(positionerElement, 'focusout', onFocus, true),
      );
    },
  );

  // The active trigger supplies the root store after the positioner has already rendered.
  const fallbackRootStore = createFloatingRootStore({
    open: () => (keepMounted() ? context.mounted : false),
  });
  const interactionStore = createFloatingRootStoreProxy(
    () => context.floatingRootStore || fallbackRootStore,
  );

  const positioning = createAnchorPositioning({
    interactionStore,
    // Without an `anchor` prop, positioning reads the active trigger's store anchor directly, so
    // it follows the active trigger in the same flush.
    get anchor() {
      return componentProps.anchor;
    },
    get positionMethod() {
      return componentProps.positionMethod;
    },
    get mounted() {
      return context.mounted;
    },
    get side() {
      return componentProps.side ?? 'bottom';
    },
    get sideOffset() {
      return componentProps.sideOffset;
    },
    get align() {
      return componentProps.align ?? 'center';
    },
    get alignOffset() {
      return componentProps.alignOffset;
    },
    get arrowPadding() {
      return componentProps.arrowPadding;
    },
    get collisionBoundary() {
      return componentProps.collisionBoundary;
    },
    get collisionPadding() {
      return componentProps.collisionPadding;
    },
    get sticky() {
      return componentProps.sticky;
    },
    get disableAnchorTracking() {
      return componentProps.disableAnchorTracking;
    },
    get keepMounted() {
      return keepMounted();
    },
    get collisionAvoidance() {
      return (
        componentProps.collisionAvoidance ??
        (context.nested ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE)
      );
    },
    shift: { rootBoundary: 'layoutViewport' },
    nodeId,
    // Allows the menu to remain anchored without wobbling while its size
    // and position transition simultaneously when side=top or side=left.
    adaptiveOrigin,
  });

  // The hover interactions of the active trigger read the popup's placement and elements from
  // its store's positioning context.
  createEffect(
    () => context.floatingRootStore,
    (store) => {
      if (store) {
        store.context.positioning = positioning.context;
      }
    },
  );

  const state: NavigationMenuPositionerState = {
    get open() {
      return context.open;
    },
    get side() {
      return positioning.side;
    },
    get align() {
      return positioning.align;
    },
    get anchorHidden() {
      return positioning.anchorHidden;
    },
    get instant() {
      return instant();
    },
  };

  createEffect(
    () => (context.open ? { positionerElement: context.positionerElement } : null),
    (params) => {
      if (!params) {
        return undefined;
      }

      if (needsInitialInstantReset) {
        initialInstantTimeout.start(0, () => {
          needsInitialInstantReset = false;

          if (!resizeTimeout.isStarted()) {
            setInstant(false);
          }
        });
      }

      function handleResize() {
        setInstant(true);
        flush();

        resizeTimeout.start(100, () => {
          setInstant(false);
        });
      }

      const win = ownerWindow(params.positionerElement);
      return addEventListener(win, 'resize', handleResize);
    },
  );

  let positionerElement: HTMLElement | null = null;
  onCleanup(() => {
    if (positionerElement && untrack(() => context.positionerElement) === positionerElement) {
      context.setPositionerElement(null);
    }
  });

  const renderElement = () => renderPositioner(componentProps, state, {
    get styles() {
      return positioning.positionerStyles;
    },
    get transitionStatus() {
      return context.transitionStatus;
    },
    props: elementProps,
    ref: (el: HTMLDivElement) => {
      positionerElement = el;
      context.setPositionerElement(el);
    },
    get hidden() {
      return !context.mounted;
    },
    get inert() {
      return !context.open;
    },
  });

  return (
    <NavigationMenuPositionerContext value={positioning}>
      {renderElement()}
    </NavigationMenuPositionerContext>
  );
}

export interface NavigationMenuPositionerState {
  /**
   * Whether the navigation menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: boolean;
}

export interface NavigationMenuPositionerProps
  extends
    CreateAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', NavigationMenuPositionerState> {}

export namespace NavigationMenuPositioner {
  export type State = NavigationMenuPositionerState;
  export type Props = NavigationMenuPositionerProps;
}
