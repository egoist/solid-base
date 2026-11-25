import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Align, Side } from '../../internals/anchorPositioning';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { renderElement } from '../../internals/renderElement';

/**
 * Displays an element positioned against the select popup anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectArrow(componentProps: SelectArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();
  onCleanup(() => positioner.arrowRef(null));

  const state: SelectArrowState = {
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
    ref: (element: HTMLElement) => positioner.arrowRef(element),
    props: [
      {
        get style() {
          return positioner.arrowStyles;
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
    enabled: () => !positioner.alignItemWithTriggerActive,
  });
}

export interface SelectArrowState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface SelectArrowProps extends BaseUIComponentProps<'div', SelectArrowState> {}

export namespace SelectArrow {
  export type State = SelectArrowState;
  export type Props = SelectArrowProps;
}
