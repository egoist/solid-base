import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { renderElement } from '../../internals/renderElement';
import { REASONS } from '../../internals/reasons';

/**
 * An overlay displayed beneath the popover.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverBackdrop(componentProps: PopoverBackdrop.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = usePopoverRootContext();

  const state: PopoverBackdrop.State = {
    get open() {
      return store.select('open');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !store.select('mounted');
        },
        get style() {
          return {
            'pointer-events':
              store.select('openChangeReason') === REASONS.triggerHover ? 'none' : undefined,
            'user-select': 'none',
            '-webkit-user-select': 'none',
          } as JSX.CSSProperties;
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface PopoverBackdropState {
  /**
   * Whether the popover is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PopoverBackdropProps extends BaseUIComponentProps<'div', PopoverBackdropState> {}

export namespace PopoverBackdrop {
  export type State = PopoverBackdropState;
  export type Props = PopoverBackdropProps;
}
