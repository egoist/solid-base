import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  createPopupViewport,
  popupViewportStateMapping,
} from '../../utils/popups/viewport/popupViewport';
import type { TooltipInstantType } from '../store/TooltipStore';

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Tooltip](https://base.egoist.dev/components/tooltip)
 */
export function TooltipViewport(componentProps: TooltipViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const viewport = createPopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    get children() {
      return componentProps.children;
    },
  });

  const state: TooltipViewport.State = {
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

export interface TooltipViewportState {
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
  instant: TooltipInstantType;
}

export interface TooltipViewportProps extends BaseUIComponentProps<'div', TooltipViewportState> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace TooltipViewport {
  export type Props = TooltipViewportProps;
  export type State = TooltipViewportState;
}
