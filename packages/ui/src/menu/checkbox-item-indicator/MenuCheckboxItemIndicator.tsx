import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMenuCheckboxItemContext } from '../checkbox-item/MenuCheckboxItemContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { itemMapping } from '../utils/stateAttributesMapping';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';

/**
 * Indicates whether the checkbox item is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuCheckboxItemIndicator(
  componentProps: MenuCheckboxItemIndicator.Props,
): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted');

  const item = useMenuCheckboxItemContext();
  const checked = () => item.checked;

  let indicatorElement: HTMLElement | null = null;

  const { transitionStatus, mounted, setMounted } = createTransitionStatus(checked);

  createOpenChangeComplete({
    enabled: () => !checked(),
    open: checked,
    element: () => indicatorElement,
    onComplete() {
      if (!untrack(checked)) {
        setMounted(false);
      }
    },
  });

  const state: MenuCheckboxItemIndicator.State = {
    get checked() {
      return item.checked;
    },
    get disabled() {
      return item.disabled;
    },
    get highlighted() {
      return item.highlighted;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  return renderElement('span', componentProps, {
    state,
    ref: (element: HTMLElement) => {
      indicatorElement = element;
    },
    stateAttributesMapping: itemMapping,
    props: [{ 'aria-hidden': true }, elementProps],
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
  });
}

export interface MenuCheckboxItemIndicatorProps extends BaseUIComponentProps<
  'span',
  MenuCheckboxItemIndicatorState
> {
  /**
   * Whether to keep the HTML element in the DOM when the checkbox item is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface MenuCheckboxItemIndicatorState {
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace MenuCheckboxItemIndicator {
  export type Props = MenuCheckboxItemIndicatorProps;
  export type State = MenuCheckboxItemIndicatorState;
}
