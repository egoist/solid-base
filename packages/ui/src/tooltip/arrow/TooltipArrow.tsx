import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { Align, Side } from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';

/**
 * Displays an element positioned against the tooltip anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipArrow(componentProps: TooltipArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  onCleanup(() => positioner.arrowRef(null));

  const state: TooltipArrow.State = {
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

export interface TooltipArrowState {
  /**
   * Whether the tooltip is currently open.
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

export interface TooltipArrowProps extends BaseUIComponentProps<'div', TooltipArrowState> {}

export namespace TooltipArrow {
  export type State = TooltipArrowState;
  export type Props = TooltipArrowProps;
}
