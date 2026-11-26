import { omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { ComboboxCollection } from '../collection/ComboboxCollection';
import {
  CompositeListContext,
  createCompositeList,
} from '../../internals/composite/list/CompositeList';
import { stopEvent } from '../../utils/popups/event';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { clickHighlightedItem } from '../utils/parts';

/**
 * A list container for the items.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxList(componentProps: ComboboxList.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children');

  const store = useComboboxRootContext();
  const hasPositionerContext = Boolean(useComboboxPositionerContext(true));
  const derivedItems = useComboboxDerivedItemsContext();

  const empty = () => derivedItems.filteredItems.length === 0;

  const state: ComboboxListState = {
    get empty() {
      return empty();
    },
  };

  let listElement: HTMLDivElement | null = null;
  onCleanup(() => {
    if (listElement && store.state.listElement === listElement) {
      store.set('listElement', null);
    }
    if (!hasPositionerContext && listElement && store.state.positionerElement === listElement) {
      store.set('positionerElement', null);
    }
  });

  // Created inside the provider: the items register with it.
  const Element = () => {
    // Support "closed template" API: if children is a function, implicitly wrap it
    // with a Combobox.Collection that reads items from context/root.
    // Read once, like every `children` prop.
    function resolveChildren() {
      const children = untrack(() => componentProps.children);
      // Solid passes some JSX children as zero-argument thunks: only a function taking the item
      // is a render function.
      return typeof children === 'function' && children.length > 0 ? (
        <ComboboxCollection>
          {children as (item: any, index: number) => JSX.Element}
        </ComboboxCollection>
      ) : (
        children
      );
    }

    return renderElement('div', componentProps, {
      state,
      ref: (el: HTMLDivElement) => {
        listElement = el;
        store.set('listElement', el);
        if (!hasPositionerContext) {
          store.set('positionerElement', el);
        }
      },
      props: [
        createDynamicPropsSource(() => store.select('listProps')),
        {
          children: resolveChildren(),
          tabindex: -1,
          get id() {
            return store.select('defaultPopupId');
          },
          get role() {
            return store.select('grid') ? 'grid' : 'listbox';
          },
          get 'aria-multiselectable'() {
            return store.select('selectionMode') === 'multiple' ? 'true' : undefined;
          },
          // On a grid the attribute describes cell editability, not selection, so it's left to the
          // combobox element in that mode.
          get 'aria-readonly'() {
            return !store.select('grid') && store.select('readOnly') ? 'true' : undefined;
          },
          onKeyDown(event: KeyboardEvent) {
            if (store.state.disabled || store.state.readOnly) {
              return;
            }

            if (event.key === 'Enter') {
              const activeIndex = store.state.activeIndex;

              if (activeIndex == null) {
                // Allow form submission when no item is highlighted.
                return;
              }

              stopEvent(event);
              clickHighlightedItem(store, activeIndex, event);
            }
          },
        } as HTMLProps,
        elementProps,
      ],
    });
  };

  // Virtualized lists register their items themselves (by index).
  // With the `items` prop, typeahead labels are derived from the items so they survive the list
  // unmounting (unmounting clears the registered labels). Rendered labels only need to be
  // registered when the list is force-mounted to match browser autofill against rendered text.
  const compositeList = createCompositeList({
    get elementsRef() {
      return store.select('virtualized') ? undefined : store.context.listRef;
    },
    get labelsRef() {
      if (store.select('virtualized')) {
        return undefined;
      }
      return derivedItems.hasItems && !store.select('forceMounted')
        ? undefined
        : store.context.labelsRef;
    },
    // Keeps the refs in sync even when nothing reads the list reactively.
    onMapChange() {},
  });

  return (
    <CompositeListContext value={compositeList}>
      <Element />
    </CompositeListContext>
  );
}

export interface ComboboxListState {
  /**
   * Whether the list is empty.
   */
  empty: boolean;
}

export interface ComboboxListProps extends Omit<
  BaseUIComponentProps<'div', ComboboxListState>,
  'children'
> {
  children?: JSX.Element | ((item: any, index: number) => JSX.Element);
}

export namespace ComboboxList {
  export type State = ComboboxListState;
  export type Props = ComboboxListProps;
}
