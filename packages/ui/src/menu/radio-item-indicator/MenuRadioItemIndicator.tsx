import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMenuRadioItemContext } from '../radio-item/MenuRadioItemContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { itemMapping } from '../utils/stateAttributesMapping';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';

/**
 * Indicates whether the radio item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuRadioItemIndicator(
  componentProps: MenuRadioItemIndicator.Props,
): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted');

  const item = useMenuRadioItemContext();
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

  const state: MenuRadioItemIndicator.State = {
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

export interface MenuRadioItemIndicatorProps extends BaseUIComponentProps<
  'span',
  MenuRadioItemIndicatorState
> {
  /**
   * Whether to keep the HTML element in the DOM when the radio item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface MenuRadioItemIndicatorState {
  /**
   * Whether the radio item is currently selected.
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

export namespace MenuRadioItemIndicator {
  export type Props = MenuRadioItemIndicatorProps;
  export type State = MenuRadioItemIndicatorState;
}
