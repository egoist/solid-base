import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { renderElement } from '../../internals/renderElement';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxBackdrop(componentProps: ComboboxBackdrop.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useComboboxRootContext();

  const state: ComboboxBackdropState = {
    get open() {
      return store.select('open');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
  };

  return renderElement('div', componentProps, {
    state,
    stateAttributesMapping: popupTransitionStateMapping,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !store.select('mounted');
        },
        style: {
          'user-select': 'none',
          '-webkit-user-select': 'none',
        },
      },
      elementProps,
    ],
  });
}

export interface ComboboxBackdropProps extends BaseUIComponentProps<'div', ComboboxBackdropState> {}

export interface ComboboxBackdropState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace ComboboxBackdrop {
  export type Props = ComboboxBackdropProps;
  export type State = ComboboxBackdropState;
}
