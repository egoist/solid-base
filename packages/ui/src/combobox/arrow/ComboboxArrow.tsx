import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import type { Align, Side } from '../../internals/anchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';

/**
 * Displays an element positioned against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxArrow(componentProps: ComboboxArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useComboboxRootContext();
  const positioner = useComboboxPositionerContext();

  onCleanup(() => positioner.arrowRef(null));

  const state: ComboboxArrowState = {
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

export interface ComboboxArrowState {
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

export interface ComboboxArrowProps extends BaseUIComponentProps<'div', ComboboxArrowState> {}

export namespace ComboboxArrow {
  export type State = ComboboxArrowState;
  export type Props = ComboboxArrowProps;
}
