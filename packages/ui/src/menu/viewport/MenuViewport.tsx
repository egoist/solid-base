import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  createPopupViewport,
  popupViewportStateMapping,
} from '../../utils/popups/viewport/popupViewport';
import type { MenuInstantType } from '../store/MenuStore';

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuViewport(componentProps: MenuViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const { store } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  const viewport = createPopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    get children() {
      return componentProps.children;
    },
  });

  const state: MenuViewport.State = {
    get activationDirection() {
      return viewport.state.activationDirection;
    },
    get transitioning() {
      return viewport.state.transitioning;
    },
    get instant() {
      return store.select('instantType');
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: [elementProps, { children: viewport.children }],
    stateAttributesMapping: popupViewportStateMapping,
  });
}

export interface MenuViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: MenuInstantType;
}

export interface MenuViewportProps extends BaseUIComponentProps<'div', MenuViewportState> {}

export namespace MenuViewport {
  export type Props = MenuViewportProps;
  export type State = MenuViewportState;
}
