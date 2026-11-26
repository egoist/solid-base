import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { renderElement } from '../../internals/renderElement';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Dialog](https://base.egoist.dev/components/dialog)
 */
export function DialogBackdrop(componentProps: DialogBackdrop.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'forceRender');

  const store = useDialogRootContext();

  const enabled = () => (componentProps.forceRender ?? false) || !store.select('nested');

  let element: HTMLElement | null = null;
  const release = () => {
    if (store.context.backdropElement === element) {
      store.context.backdropElement = null;
    }
  };
  onCleanup(release);

  const state: DialogBackdrop.State = {
    get open() {
      return store.select('open');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
  };

  return renderElement('div', componentProps, {
    state,
    ref: (el: HTMLElement) => {
      element = el;
      store.context.backdropElement = el;
    },
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
    enabled,
  });
}

export interface DialogBackdropProps extends BaseUIComponentProps<'div', DialogBackdropState> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DialogBackdropState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace DialogBackdrop {
  export type Props = DialogBackdropProps;
  export type State = DialogBackdropState;
}
