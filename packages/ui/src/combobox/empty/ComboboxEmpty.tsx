import { Show, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { createInitialLiveRegionTextMutation } from '../../internals/initialLiveRegionTextMutation';

/**
 * Renders its children only when the list is empty.
 * Requires the `items` prop on the root component.
 * Announces changes politely to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxEmpty(componentProps: ComboboxEmpty.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const derivedItems = useComboboxDerivedItemsContext();
  const store = useComboboxRootContext();

  const emptyRef = createInitialLiveRegionTextMutation<HTMLDivElement>();
  let element: HTMLDivElement | null = null;

  onCleanup(() => {
    if (element && store.context.emptyRef.current === element) {
      store.context.emptyRef.current = null;
    }
  });

  const isEmpty = () => derivedItems.filteredItems.length === 0;
  const children = untrack(() => componentProps.children);

  return renderElement('div', componentProps, {
    ref: [
      (el: HTMLDivElement) => {
        element = el;
        store.context.emptyRef.current = el;
      },
      emptyRef,
    ],
    props: [
      {
        children: <Show when={isEmpty()}>{children}</Show>,
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': true,
      },
      elementProps,
    ],
  });
}

export interface ComboboxEmptyState {}

export interface ComboboxEmptyProps extends BaseUIComponentProps<'div', ComboboxEmptyState> {}

export namespace ComboboxEmpty {
  export type State = ComboboxEmptyState;
  export type Props = ComboboxEmptyProps;
}
