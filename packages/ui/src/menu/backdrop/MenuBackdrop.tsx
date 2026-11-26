import { omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMenuRootContext } from '../root/MenuRootContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { REASONS } from '../../internals/reasons';

/**
 * An overlay displayed beneath the menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuBackdrop(componentProps: MenuBackdrop.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const { store } = useMenuRootContext();
  const contextMenuContext = useContextMenuRootContext();

  let element: HTMLDivElement | undefined;
  onCleanup(() => {
    if (contextMenuContext && contextMenuContext.backdropRef.current === element) {
      contextMenuContext.backdropRef.current = null;
    }
  });

  const state: MenuBackdrop.State = {
    get open() {
      return store.select('open');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
  };

  return renderElement('div', componentProps, {
    ref: (el: HTMLDivElement) => {
      element = el;
      if (contextMenuContext) {
        contextMenuContext.backdropRef.current = el;
      }
    },
    state,
    stateAttributesMapping: popupTransitionStateMapping,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !store.select('mounted');
        },
        get style() {
          return {
            'pointer-events':
              store.select('lastOpenChangeReason') === REASONS.triggerHover ? 'none' : undefined,
            'user-select': 'none',
            '-webkit-user-select': 'none',
          } as JSX.CSSProperties;
        },
      },
      elementProps,
    ],
  });
}

export interface MenuBackdropState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface MenuBackdropProps extends BaseUIComponentProps<'div', MenuBackdropState> {}

export namespace MenuBackdrop {
  export type State = MenuBackdropState;
  export type Props = MenuBackdropProps;
}
