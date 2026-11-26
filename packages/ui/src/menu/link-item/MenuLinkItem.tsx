import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMenuRootContext } from '../root/MenuRootContext';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import { createMenuItemCommonProps } from '../item/createMenuItemCommonProps';
import { REGULAR_ITEM } from '../item/createMenuItem';
import { createButton } from '../../internals/use-button/createButton';
import { mergeProps } from '../../merge-props/mergeProps';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { renderFilteredItem } from '../item/filteredItem';

function MenuLinkItemPlain(componentProps: MenuLinkItem.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'label', 'closeOnClick');

  const { store } = useMenuRootContext();

  let linkElement: HTMLElement | null = null;

  const listItem = useCompositeListItem({ label: () => componentProps.label });
  const id = createBaseUiId(() => componentProps.id);

  const highlighted = () => store.select('isActive', listItem.index());

  const { getButtonProps, buttonRef } = createButton({
    native: () => false,
    composite: () => true,
  });

  const commonProps = createMenuItemCommonProps({
    get closeOnClick() {
      return componentProps.closeOnClick ?? false;
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return id();
    },
    get nodeId() {
      return store.select('floatingNodeId');
    },
    store,
    typingRef: store.context.typingRef,
    getItemElement: () => linkElement,
    itemMetadata: REGULAR_ITEM,
  });

  function getItemProps(externalProps?: HTMLProps): HTMLProps {
    return mergeProps(commonProps, externalProps, getButtonProps);
  }

  const state: MenuLinkItem.State = {
    get highlighted() {
      return highlighted();
    },
  };

  return renderElement('a', componentProps, {
    state,
    props: [createDynamicPropsSource(() => store.select('itemProps')), elementProps, getItemProps],
    ref: [
      (element: HTMLElement) => {
        linkElement = element;
      },
      buttonRef,
      listItem.ref,
    ],
  });
}

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuLinkItem(props: MenuLinkItem.Props): JSX.Element {
  return renderFilteredItem(props, MenuLinkItemPlain);
}

export interface MenuLinkItemState {
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuLinkItemProps
  extends Omit<BaseUIComponentProps<'a', MenuLinkItemState>, 'id'> {
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
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuLinkItem {
  export type State = MenuLinkItemState;
  export type Props = MenuLinkItemProps;
}
