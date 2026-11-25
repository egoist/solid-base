import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { renderElement } from '../../internals/renderElement';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerBackdropCssVars from './DrawerBackdropCssVars';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerBackdrop(componentProps: DrawerBackdrop.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'forceRender');

  const store = useDialogRootContext();

  const open = () => store.select('open');

  let element: HTMLElement | null = null;
  onCleanup(() => {
    if (store.context.backdropElement === element) {
      store.context.backdropElement = null;
    }
  });

  const state: DrawerBackdrop.State = {
    get open() {
      return open();
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
        get style() {
          return {
            'pointer-events': !open() ? 'none' : undefined,
            'user-select': 'none',
            '-webkit-user-select': 'none',
            [DrawerBackdropCssVars.swipeProgress]: '0',
            [DrawerPopupCssVars.swipeStrength]: '1',
          } as JSX.CSSProperties;
        },
      },
      elementProps,
    ],
    enabled: () => (componentProps.forceRender ?? false) || !store.select('nested'),
  });
}

export interface DrawerBackdropProps extends BaseUIComponentProps<'div', DrawerBackdropState> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace DrawerBackdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}
