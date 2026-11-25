import { createMemo, omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FilterDropdownInput } from '../../filter-dropdown/input/FilterDropdownInput';
import type {
  FilterDropdownInputProps,
  FilterDropdownInputState,
} from '../../filter-dropdown/input/FilterDropdownInput';
import { useFilterDropdownRootContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { mergeProps } from '../../merge-props/mergeProps';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import type { HTMLProps } from '../../internals/types';
import { createMenuFilterKeyDown } from '../filter-root/useMenuFilterKeyDown';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';

/**
 * A search field that filters the menu items.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuInput(componentProps: MenuInput.Props): JSX.Element {
  useMenuFilterPart('Input');
  const { store } = useMenuRootContext();
  const filterContext = useFilterDropdownRootContext();

  // The input routes key presses itself, so the list navigation's key handler is left out.
  const navigationProps = createDynamicPropsSource(
    createMemo(
      () => omit(store.select('inputProps') as Record<string, any>, 'onKeyDown') as HTMLProps,
    ),
  );

  const handleKeyDown = createMenuFilterKeyDown(() => filterContext.value !== '');

  onCleanup(() => {
    store.set('inputFocused', false);
  });

  const inputProps = mergeProps<MenuInput.Props>(
    {
      onKeyDown: handleKeyDown,
      onFocus() {
        store.set('inputFocused', true);
      },
      onBlur() {
        store.set('inputFocused', false);
      },
    },
    componentProps,
  );

  return (
    <FilterDropdownInput
      {...inputProps}
      activeItemId={store.select('highlightedItemId')}
      navigationProps={navigationProps}
    />
  );
}

export interface MenuInputState extends FilterDropdownInputState {}
export interface MenuInputProps extends FilterDropdownInputProps {}

export namespace MenuInput {
  export type State = MenuInputState;
  export type Props = MenuInputProps;
}
