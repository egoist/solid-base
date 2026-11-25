import { omit, type Accessor } from 'solid-js';
import type { BaseUIComponentProps } from '../internals/types';
import { createTransitionStatus, type TransitionStatus } from '../internals/transitionStatus';
import { createOpenChangeComplete } from '../internals/openChangeComplete';
import { renderElement } from '../internals/renderElement';
import { transitionStatusMapping } from '../internals/stateAttributesMapping';

/**
 * The indicator of a selected list item (Select, Combobox). Renders a `<span>` element.
 * Mounted while `selected` (or `keepMounted`), and through its exit animation.
 *
 * @internal
 */
export function ItemIndicator(componentProps: ItemIndicatorProps) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted', 'selected');

  const selected: Accessor<boolean> = () => componentProps.selected;
  const { mounted, transitionStatus, setMounted } = createTransitionStatus(selected);

  let indicatorElement: HTMLSpanElement | null = null;

  const state: ItemIndicatorState = {
    get selected() {
      return selected();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  createOpenChangeComplete({
    enabled: () => !selected(),
    open: selected,
    element: () => indicatorElement,
    onComplete() {
      if (!selected()) {
        setMounted(false);
      }
    },
  });

  return renderElement('span', componentProps, {
    state,
    ref: (element: HTMLSpanElement) => {
      indicatorElement = element;
    },
    props: [
      {
        'aria-hidden': true,
        children: '✔️',
      },
      elementProps,
    ],
    stateAttributesMapping: transitionStatusMapping,
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
  });
}

export interface ItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export interface ItemIndicatorProps extends BaseUIComponentProps<'span', ItemIndicatorState> {
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
  selected: boolean;
}
