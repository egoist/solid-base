import { createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { ComboboxGroupContext } from './ComboboxGroupContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { GroupCollectionProvider } from '../collection/GroupCollectionContext';

/**
 * Groups related items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroup(componentProps: ComboboxGroup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'items');

  const store = useComboboxRootContext();

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });

  const contextValue: ComboboxGroupContext = {
    labelId,
    setLabelId,
    items: () => componentProps.items,
  };

  // Created inside the providers: the children read them.
  const Element = () =>
    renderElement('div', componentProps, {
      props: [
        {
          // `group` is not a valid owned element of `grid`, and `row` must be owned
          // by `grid`, `rowgroup`, or `treegrid`.
          get role() {
            return store.select('grid') ? 'rowgroup' : 'group';
          },
          get 'aria-labelledby'() {
            return labelId();
          },
        },
        elementProps,
      ],
    });

  const WrappedElement = () => (
    <ComboboxGroupContext value={contextValue}>
      <Element />
    </ComboboxGroupContext>
  );

  // Whether the group provides items is read once: a collection wrapper can't be added later.
  if (untrack(() => componentProps.items) !== undefined) {
    return (
      <GroupCollectionProvider items={componentProps.items ?? []}>
        <WrappedElement />
      </GroupCollectionProvider>
    );
  }

  return <WrappedElement />;
}

export interface ComboboxGroupState {}

export interface ComboboxGroupProps extends BaseUIComponentProps<'div', ComboboxGroupState> {
  /**
   * Items to be rendered within this group.
   * When provided, child `Collection` components will use these items.
   */
  items?: readonly any[] | undefined;
}

export namespace ComboboxGroup {
  export type State = ComboboxGroupState;
  export type Props = ComboboxGroupProps;
}
