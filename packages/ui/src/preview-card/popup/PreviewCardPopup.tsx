import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
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
import type { PreviewCardInstantType } from '../store/PreviewCardStore';

/**
 * A container for the preview card contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardPopup(componentProps: PreviewCardPopup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

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
    closeDelay: () => store.select('closeDelay'),
  });

  const state: PreviewCardPopup.State = {
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

export interface PreviewCardPopupState {
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
   * Whether transitions should be skipped.
   */
  instant: PreviewCardInstantType;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PreviewCardPopupProps extends BaseUIComponentProps<'div', PreviewCardPopupState> {}

export namespace PreviewCardPopup {
  export type State = PreviewCardPopupState;
  export type Props = PreviewCardPopupProps;
}
