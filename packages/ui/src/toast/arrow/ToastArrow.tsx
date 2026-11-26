import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useToastPositionerContext } from '../positioner/ToastPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Side, Align } from '../../internals/anchorPositioning';
import { renderElement } from '../../internals/renderElement';

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Toast](https://base.egoist.dev/components/toast)
 */
export function ToastArrow(componentProps: ToastArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const positioning = useToastPositionerContext();
  onCleanup(() => positioning.arrowRef(null));

  const state: ToastArrow.State = {
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

  return renderElement('div', componentProps, {
    state,
    ref: (element: HTMLElement) => positioning.arrowRef(element),
    props: [
      {
        get style() {
          return positioning.arrowStyles;
        },
        'aria-hidden': 'true',
      },
      elementProps,
    ],
  });
}

export interface ToastArrowState {
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

export interface ToastArrowProps extends BaseUIComponentProps<'div', ToastArrowState> {}

export namespace ToastArrow {
  export type State = ToastArrowState;
  export type Props = ToastArrowProps;
}
