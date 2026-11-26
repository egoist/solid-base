import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Align, Side } from '../../internals/anchorPositioning';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import { renderElement } from '../../internals/renderElement';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { createHoverPopupInteraction } from '../../utils/popups/interactions/hoverPopupInteraction';
import {
  FOCUSABLE_POPUP_PROPS,
  createDynamicPropsSource,
} from '../../utils/popups/popupStoreUtils';
import type { TooltipInstantType } from '../store/TooltipStore';

/**
 * A container for the tooltip contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Tooltip](https://base.egoist.dev/components/tooltip)
 */
export function TooltipPopup(componentProps: TooltipPopup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const open = () => store.select('open');
  const transitionStatus = () => store.select('transitionStatus');

  createOpenChangeComplete({
    open,
    element: () => store.select('popupElement'),
    onComplete() {
      if (store.state.openProp ?? store.state.open) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  createHoverPopupInteraction(store, {
    get enabled() {
      return !store.select('disabled');
    },
    closeDelay: () => store.select('closeDelay'),
  });

  const state: TooltipPopup.State = {
    get open() {
      return open();
    },
    get side() {
      return positioner.side;
    },
    get align() {
      return positioner.align;
    },
    get instant() {
      return store.select('instantType');
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  return renderElement('div', componentProps, {
    state,
    ref: (el: HTMLElement) => store.set('popupElement', el),
    props: [
      FOCUSABLE_POPUP_PROPS,
      createDynamicPropsSource(() => store.select('popupProps')),
      {
        get style() {
          return getDisabledMountTransitionStyles(transitionStatus()).style;
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface TooltipPopupState {
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
   * Whether transitions should be skipped.
   */
  instant: TooltipInstantType;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TooltipPopupProps extends BaseUIComponentProps<'div', TooltipPopupState> {}

export namespace TooltipPopup {
  export type State = TooltipPopupState;
  export type Props = TooltipPopupProps;
}
