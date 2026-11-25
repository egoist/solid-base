import { createButton } from '../../internals/use-button/createButton';
import { mergeProps } from '../../merge-props/mergeProps';
import type { RefObject } from '@egoist/solid-base-utils/refObject';
import type { HTMLProps } from '../../internals/types';
import type { MenuStore } from '../store/MenuStore';
import { createMenuItemCommonProps } from './createMenuItemCommonProps';

export const REGULAR_ITEM = {
  type: 'regular-item' as const,
};

/**
 * Gives an element the behavior of a menu item. Parameters are read lazily (pass getters for
 * reactive values); `store`, `typingRef` and `itemMetadata` are read once.
 */
export function createMenuItem(params: CreateMenuItemParameters): CreateMenuItemReturnValue {
  const { store, itemMetadata } = params;
  const typingRef = params.typingRef ?? store.context.typingRef;

  let itemElement: HTMLElement | null = null;

  const { getButtonProps, buttonRef } = createButton({
    disabled: () => params.disabled,
    focusableWhenDisabled: () => true,
    native: () => params.nativeButton,
    composite: () => true,
  });

  const commonProps = createMenuItemCommonProps({
    get closeOnClick() {
      return params.closeOnClick;
    },
    get highlighted() {
      return params.highlighted;
    },
    get id() {
      return params.id;
    },
    get nodeId() {
      return params.nodeId;
    },
    store,
    typingRef,
    getItemElement: () => itemElement,
    itemMetadata,
  });

  const hoverProps: HTMLProps = {
    onMouseEnter(event: MouseEvent) {
      if (itemMetadata.type !== 'submenu-trigger') {
        return;
      }

      itemMetadata.setActive(event);
    },
  };

  function getItemProps(externalProps?: HTMLProps): HTMLProps {
    return mergeProps(commonProps, hoverProps, externalProps, getButtonProps);
  }

  return {
    getItemProps,
    itemRef(element: HTMLElement) {
      itemElement = element;
      buttonRef(element);
    },
    getItemElement: () => itemElement,
  };
}

export interface CreateMenuItemParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  readonly closeOnClick: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  readonly disabled: boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  readonly highlighted: boolean;
  /**
   * The id of the menu item.
   */
  readonly id: string | undefined;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   */
  readonly nativeButton: boolean;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: MenuItemMetadata;
  /**
   * The node id of the menu positioner.
   */
  readonly nodeId: string | undefined;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   * @default store.context.typingRef
   */
  typingRef?: RefObject<boolean> | undefined;
}

export type MenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: 'submenu-trigger';
      setActive: (event: MouseEvent) => void;
    };

export interface CreateMenuItemReturnValue {
  /**
   * A function props source for `renderElement` (put it last): wraps the props merged so far.
   */
  getItemProps: (externalProps?: HTMLProps) => HTMLProps;
  /**
   * The ref to the component's root DOM element.
   */
  itemRef: (element: HTMLElement) => void;
  /**
   * Returns the item element.
   */
  getItemElement: () => HTMLElement | null;
}
