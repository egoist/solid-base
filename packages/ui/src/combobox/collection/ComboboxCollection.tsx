import { For, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import { useGroupCollectionContext } from './GroupCollectionContext';

/**
 * Renders filtered list items.
 * Doesn't render its own HTML element.
 *
 * If rendering a flat list, pass a function child to the `List` component instead, which
 * implicitly wraps it.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxCollection(props: ComboboxCollection.Props): JSX.Element {
  const derivedItems = useComboboxDerivedItemsContext();
  const groupContext = useGroupCollectionContext();

  const itemsToRender = () =>
    groupContext ? groupContext.items() : (derivedItems.filteredItems as readonly any[]);

  // Read once: the render function.
  const renderItem = untrack(() => props.children);
  // A render function that declares the `index` parameter is called again (recreating the item)
  // when the item's index changes, so explicit `index` props stay in sync with the filtered list.
  const usesIndex = renderItem.length > 1;

  return (
    <For each={itemsToRender()}>
      {(item, index) =>
        usesIndex ? <>{renderItem(item, index())}</> : renderItem(item, untrack(index))
      }
    </For>
  );
}

export interface ComboboxCollectionState {}

export interface ComboboxCollectionProps {
  /**
   * Renders an item. Called once per item, and again whenever the item's index changes when the
   * function declares the `index` parameter.
   */
  children: (item: any, index: number) => JSX.Element;
}

export namespace ComboboxCollection {
  export type State = ComboboxCollectionState;
  export type Props = ComboboxCollectionProps;
}
