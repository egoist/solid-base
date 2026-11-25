import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';

/**
 * A backdrop for the navigation menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuBackdrop(componentProps: NavigationMenuBackdrop.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const context = useNavigationMenuRootContext();

  const state: NavigationMenuBackdropState = {
    get open() {
      return context.open;
    },
    get transitionStatus() {
      return context.transitionStatus;
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !context.mounted;
        },
        style: {
          'user-select': 'none',
          '-webkit-user-select': 'none',
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface NavigationMenuBackdropState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
}

export interface NavigationMenuBackdropProps extends BaseUIComponentProps<
  'div',
  NavigationMenuBackdropState
> {}

export namespace NavigationMenuBackdrop {
  export type State = NavigationMenuBackdropState;
  export type Props = NavigationMenuBackdropProps;
}
