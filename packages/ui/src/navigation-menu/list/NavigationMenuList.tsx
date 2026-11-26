import { createMemo, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { closest, getTarget } from '@egoist/solid-base-utils/shadowDom';
import { createDismiss } from '../../utils/popups/interactions/dismiss';
import { createHoverPopupInteraction } from '../../utils/popups/interactions/hoverPopupInteraction';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { renderElement } from '../../internals/renderElement';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { NavigationMenuDismissContext } from './NavigationMenuDismissContext';

/**
 * Contains a list of navigation menu items.
 * Renders a `<ul>` element.
 *
 * Documentation: [Solid Base Navigation Menu](https://base.egoist.dev/components/navigation-menu)
 */
export function NavigationMenuList(componentProps: NavigationMenuList.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const nodeId = useNavigationMenuTreeContext();
  const context = useNavigationMenuRootContext();
  const nested = context.nested;

  const interactionsEnabled = () => context.positionerElement != null || context.value == null;
  const hoverInteractionsEnabled = () =>
    context.positionerElement != null || context.viewportElement != null || context.value == null;

  // The interactions belong to the active trigger's store: they're created again (and the
  // previous ones disposed) whenever another trigger becomes active.
  const dismiss = createMemo(() => {
    const store = context.floatingRootStore;
    if (!store) {
      return undefined;
    }

    return untrack(() => {
      createHoverPopupInteraction(store, {
        get enabled() {
          return hoverInteractionsEnabled();
        },
        get closeDelay() {
          return context.closeDelay;
        },
        nodeId,
      });

      return createDismiss(store, {
        get enabled() {
          return interactionsEnabled();
        },
        outsidePressEvent: 'intentional',
        outsidePress(event) {
          const target = getTarget(event) as HTMLElement | null;
          const closestNavigationMenuTrigger = closest(
            target,
            `[${NAVIGATION_MENU_TRIGGER_IDENTIFIER}]`,
          );
          return closestNavigationMenuTrigger === null;
        },
      });
    });
  });

  const dismissFloatingProps = createDynamicPropsSource(() => dismiss()?.floating);
  const dismissReferenceProps = createDynamicPropsSource(() => dismiss()?.reference);

  const state: NavigationMenuListState = {
    get open() {
      return context.open;
    },
  };

  // `stopEventPropagation` won't stop the propagation if the end of the list is reached,
  // but we want to block it in this case.
  // When nested, skip this handler so arrow keys can reach the parent CompositeRoot.
  const defaultProps: HTMLProps = nested
    ? {}
    : {
        onKeyDown(event: KeyboardEvent) {
          const orientation = context.orientation;
          const shouldStop =
            (orientation === 'horizontal' &&
              (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
            (orientation === 'vertical' && (event.key === 'ArrowUp' || event.key === 'ArrowDown'));

          if (shouldStop) {
            event.stopPropagation();
          }
        },
      };

  const props = [dismissFloatingProps, defaultProps, elementProps];

  // When nested, skip the CompositeRoot wrapper so that triggers can participate
  // in the parent Content's composite navigation context. The key propagation
  // guard is already omitted through `defaultProps` above.
  if (nested) {
    return (
      <NavigationMenuDismissContext value={dismissReferenceProps}>
        {renderElement('ul', componentProps, {
          state,
          props,
        })}
      </NavigationMenuDismissContext>
    );
  }

  return (
    <NavigationMenuDismissContext value={dismissReferenceProps}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        props={props}
        loopFocus={false}
        orientation={context.orientation}
        tag="ul"
      />
    </NavigationMenuDismissContext>
  );
}

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export interface NavigationMenuListProps extends BaseUIComponentProps<
  'ul',
  NavigationMenuListState
> {}

export namespace NavigationMenuList {
  export type State = NavigationMenuListState;
  export type Props = NavigationMenuListProps;
}
