import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { REGULAR_ITEM, createMenuItem } from './createMenuItem';
import { useMenuRootContext } from '../root/MenuRootContext';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { renderFilteredItem } from './filteredItem';

function MenuItemPlain(componentProps: MenuItem.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'label',
    'nativeButton',
    'disabled',
    'closeOnClick',
  );

  const { store } = useMenuRootContext();

  const listItem = useCompositeListItem({ label: () => componentProps.label });
  const id = createBaseUiId(() => componentProps.id);

  const highlighted = () => store.select('isActive', listItem.index());
  const disabled = () => (componentProps.disabled ?? false) || store.select('disabled');

  const { getItemProps, itemRef } = createMenuItem({
    get closeOnClick() {
      return componentProps.closeOnClick ?? true;
    },
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return id();
    },
    get nativeButton() {
      return componentProps.nativeButton ?? false;
    },
    get nodeId() {
      return store.select('floatingNodeId');
    },
    store,
    itemMetadata: REGULAR_ITEM,
  });

  const state: MenuItem.State = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
  };

  return renderElement('div', componentProps, {
    state,
    props: [createDynamicPropsSource(() => store.select('itemProps')), elementProps, getItemProps],
    ref: [itemRef, listItem.ref],
  });
}

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuItem(props: MenuItem.Props): JSX.Element {
  return renderFilteredItem(props, MenuItemPlain);
}

export interface MenuItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', MenuItemState>, 'id'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   *
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuItem {
  export type State = MenuItemState;
  export type Props = MenuItemProps;
}
