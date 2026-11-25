import { createSignal, omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import { createInitialLiveRegionTextMutation } from '../../internals/initialLiveRegionTextMutation';

/**
 * @internal
 */
export function FilterDropdownEmpty(componentProps: FilterDropdownEmpty.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const { store } = useFilterDropdownItemContext();

  // Items mounting alongside register in effects, after this part is created. Deciding once they
  // have keeps the children from mounting for a frame on every open.
  const [ready, setReady] = createSignal(false);
  onSettled(() => {
    setReady(true);
  });

  const visible = () => ready() && store.select('isEmpty');

  const emptyRef = createInitialLiveRegionTextMutation<HTMLDivElement>(visible);

  return renderElement('div', componentProps, {
    enabled: visible,
    ref: emptyRef,
    props: [
      {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': true,
      },
      elementProps,
    ],
  });
}

export interface FilterDropdownEmptyState {}

export interface FilterDropdownEmptyProps extends BaseUIComponentProps<
  'div',
  FilterDropdownEmptyState
> {}

export namespace FilterDropdownEmpty {
  export type Props = FilterDropdownEmptyProps;
  export type State = FilterDropdownEmptyState;
}
