import { omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { createBaseUiId } from '../../internals/baseUiId';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { Align, Side } from '../../internals/anchorPositioning';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';

/**
 * A container for the navigation menu contents.
 * Renders a `<nav>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPopup(componentProps: NavigationMenuPopup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const context = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();
  const direction = useDirection();

  const id = createBaseUiId(() => componentProps.id as string | undefined);

  const state: NavigationMenuPopupState = {
    get open() {
      return context.open;
    },
    get transitionStatus() {
      return context.transitionStatus;
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
  };

  let popupElement: HTMLElement | null = null;
  onCleanup(() => {
    if (popupElement && untrack(() => context.popupElement) === popupElement) {
      context.setPopupElement(null);
    }
  });

  return renderElement('nav', componentProps, {
    state,
    ref: (element: HTMLElement) => {
      popupElement = element;
      context.setPopupElement(element);
    },
    props: [
      {
        get id() {
          return id();
        },
        tabindex: -1,
        get style() {
          const side = positioning.side;
          // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or
          // `right` (side=left).
          let isPhysicalLeft = side === 'left';
          if (direction() === 'rtl') {
            isPhysicalLeft = isPhysicalLeft || side === 'inline-end';
          } else {
            isPhysicalLeft = isPhysicalLeft || side === 'inline-start';
          }
          const isOriginSide = side === 'top' || isPhysicalLeft;

          return isOriginSide
            ? ({
                position: 'absolute',
                [side === 'top' ? 'bottom' : 'top']: '0',
                [isPhysicalLeft ? 'right' : 'left']: '0',
              } as JSX.CSSProperties)
            : {};
        },
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(context.transitionStatus).style;
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface NavigationMenuPopupProps extends BaseUIComponentProps<
  'nav',
  NavigationMenuPopupState
> {}

export namespace NavigationMenuPopup {
  export type State = NavigationMenuPopupState;
  export type Props = NavigationMenuPopupProps;
}
