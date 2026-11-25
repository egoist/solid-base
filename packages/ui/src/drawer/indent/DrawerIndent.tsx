import { omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { renderElement } from '../../internals/renderElement';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';

const stateAttributesMapping: StateAttributesMapping<DrawerIndentState> = {
  active(value): Record<string, string> | null {
    if (value) {
      return { 'data-active': '' };
    }
    return { 'data-inactive': '' };
  },
};

/**
 * A wrapper element intended to contain your app's main UI.
 * Applies `data-active` when any drawer within the nearest `<Drawer.Provider>` is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerIndent(componentProps: DrawerIndent.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const providerContext = useDrawerProviderContext();
  const visualStateStore = providerContext?.visualStateStore;

  let indentElement: HTMLElement | undefined;

  onSettled(() => {
    const element = indentElement;
    if (!element || !visualStateStore) {
      return undefined;
    }

    const syncVisualState = () => {
      const { swipeProgress, frontmostHeight } = visualStateStore.getSnapshot();
      if (swipeProgress <= 0) {
        element.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      } else {
        element.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${swipeProgress}`);
      }

      if (frontmostHeight <= 0) {
        element.style.removeProperty(DrawerPopupCssVars.height);
      } else {
        element.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
      }
    };

    syncVisualState();

    const unsubscribe = visualStateStore.subscribe(syncVisualState);
    return () => {
      unsubscribe();
      element.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      element.style.removeProperty(DrawerPopupCssVars.height);
    };
  });

  const state: DrawerIndentState = {
    get active() {
      return providerContext?.active ?? false;
    },
  };

  return renderElement('div', componentProps, {
    ref: (element: HTMLElement) => {
      indentElement = element;
    },
    state,
    props: [
      {
        style: {
          [DrawerBackdropCssVars.swipeProgress]: '0',
        } as JSX.CSSProperties,
      },
      elementProps,
    ],
    stateAttributesMapping,
  });
}

export interface DrawerIndentState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentProps extends BaseUIComponentProps<'div', DrawerIndentState> {}

export namespace DrawerIndent {
  export type State = DrawerIndentState;
  export type Props = DrawerIndentProps;
}
