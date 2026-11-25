import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  createPopupViewport,
  popupViewportStateMapping,
} from '../../utils/popups/viewport/popupViewport';
import type { PreviewCardInstantType } from '../store/PreviewCardStore';

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI PreviewCard](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardViewport(componentProps: PreviewCardViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  const viewport = createPopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    get children() {
      return componentProps.children;
    },
  });

  const state: PreviewCardViewport.State = {
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

export interface PreviewCardViewportState {
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
  instant: PreviewCardInstantType;
}

export interface PreviewCardViewportProps extends BaseUIComponentProps<'div', PreviewCardViewportState> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace PreviewCardViewport {
  export type Props = PreviewCardViewportProps;
  export type State = PreviewCardViewportState;
}
