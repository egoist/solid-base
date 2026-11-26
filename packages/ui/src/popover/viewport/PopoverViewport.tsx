import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  createPopupViewport,
  popupViewportStateMapping,
} from '../../utils/popups/viewport/popupViewport';
import type { PopoverInstantType } from '../store/PopoverStore';

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverViewport(componentProps: PopoverViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();

  const viewport = createPopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    get children() {
      return componentProps.children;
    },
  });

  const state: PopoverViewport.State = {
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

export interface PopoverViewportState {
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
  instant: PopoverInstantType;
}

export interface PopoverViewportProps extends BaseUIComponentProps<'div', PopoverViewportState> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace PopoverViewport {
  export type Props = PopoverViewportProps;
  export type State = PopoverViewportState;
}
