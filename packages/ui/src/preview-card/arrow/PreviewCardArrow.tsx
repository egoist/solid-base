import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { Align, Side } from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';

/**
 * Displays an element positioned against the preview card anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI PreviewCard](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardArrow(componentProps: PreviewCardArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  onCleanup(() => positioner.arrowRef(null));

  const state: PreviewCardArrow.State = {
    get open() {
      return store.select('open');
    },
    get side() {
      return positioner.side;
    },
    get align() {
      return positioner.align;
    },
    get uncentered() {
      return positioner.arrowUncentered;
    },
  };

  return renderElement('div', componentProps, {
    state,
    ref: (el: HTMLElement) => positioner.arrowRef(el),
    props: [
      {
        get style() {
          return positioner.arrowStyles;
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}

export interface PreviewCardArrowState {
  /**
   * Whether the preview card is currently open.
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

export interface PreviewCardArrowProps extends BaseUIComponentProps<'div', PreviewCardArrowState> {}

export namespace PreviewCardArrow {
  export type State = PreviewCardArrowState;
  export type Props = PreviewCardArrowProps;
}
