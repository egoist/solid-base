import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { Align, Side } from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';

/**
 * Displays an element pointing toward the navigation menu's current anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Navigation Menu](https://base.egoist.dev/components/navigation-menu)
 */
export function NavigationMenuArrow(componentProps: NavigationMenuArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const context = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();

  const state: NavigationMenuArrowState = {
    get open() {
      return context.open;
    },
    get side() {
      return positioning.side;
    },
    get align() {
      return positioning.align;
    },
    get uncentered() {
      return positioning.arrowUncentered;
    },
  };

  onCleanup(() => positioning.arrowRef(null));

  return renderElement('div', componentProps, {
    state,
    ref: positioning.arrowRef,
    props: [
      {
        get style() {
          return positioning.arrowStyles;
        },
        'aria-hidden': true,
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(context.transitionStatus).style;
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}

export interface NavigationMenuArrowState {
  /**
   * Whether the popup is currently open.
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
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface NavigationMenuArrowProps extends BaseUIComponentProps<
  'div',
  NavigationMenuArrowState
> {}

export namespace NavigationMenuArrow {
  export type State = NavigationMenuArrowState;
  export type Props = NavigationMenuArrowProps;
}
