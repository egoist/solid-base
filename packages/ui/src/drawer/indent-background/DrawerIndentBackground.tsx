import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';

const stateAttributesMapping: StateAttributesMapping<DrawerIndentBackgroundState> = {
  active(value): Record<string, string> | null {
    if (value) {
      return { 'data-active': '' };
    }
    return { 'data-inactive': '' };
  },
};

/**
 * An element placed before `<Drawer.Indent>` to render a background layer that can be styled based on whether any drawer is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Drawer](https://base.egoist.dev/components/drawer)
 */
export function DrawerIndentBackground(
  componentProps: DrawerIndentBackground.Props,
): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const providerContext = useDrawerProviderContext();

  const state: DrawerIndentBackgroundState = {
    get active() {
      return providerContext?.active ?? false;
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping,
  });
}

export interface DrawerIndentBackgroundState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentBackgroundProps extends BaseUIComponentProps<
  'div',
  DrawerIndentBackgroundState
> {}

export namespace DrawerIndentBackground {
  export type State = DrawerIndentBackgroundState;
  export type Props = DrawerIndentBackgroundProps;
}
