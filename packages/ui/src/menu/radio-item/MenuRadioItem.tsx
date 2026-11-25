import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { NOOP } from "@egoist/solid-base-utils/empty";
import { useMenuRootContext } from "../root/MenuRootContext";
import { renderElement } from "../../internals/renderElement";
import { createBaseUiId } from "../../internals/baseUiId";
import type {
  BaseUIComponentProps,
  NonNativeButtonProps,
} from "../../internals/types";
import { useMenuRadioGroupContext } from "../radio-group/MenuRadioGroupContext";
import { MenuRadioItemContext } from "./MenuRadioItemContext";
import { itemMapping } from "../utils/stateAttributesMapping";
import { useCompositeListItem } from "../../internals/composite/list/CompositeList";
import { REGULAR_ITEM, createMenuItem } from "../item/createMenuItem";
import { createChangeEventDetails } from "../../internals/createBaseUIEventDetails";
import { REASONS } from "../../internals/reasons";
import { createDynamicPropsSource } from "../../utils/popups/popupStoreUtils";
import type { MenuRadioGroup } from "../radio-group/MenuRadioGroup";
import { renderFilteredItem } from "../item/filteredItem";

function MenuRadioItemPlain(componentProps: MenuRadioItem.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    "render",
    "class",
    "style",
    "id",
    "label",
    "nativeButton",
    "disabled",
    "closeOnClick",
    "value",
  );

  const { store } = useMenuRootContext();
  const group = useMenuRadioGroupContext();

  const listItem = useCompositeListItem({ label: () => componentProps.label });
  const id = createBaseUiId(() => componentProps.id);

  const highlighted = () => store.select("isActive", listItem.index());
  const disabled = () =>
    (componentProps.disabled ?? false) ||
    group.disabled ||
    store.select("disabled");
  const checked = () => group.value === componentProps.value;

  const { getItemProps, itemRef } = createMenuItem({
    get closeOnClick() {
      return componentProps.closeOnClick ?? false;
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
      return store.select("floatingNodeId");
    },
    store,
    itemMetadata: REGULAR_ITEM,
  });

  const state: MenuRadioItem.State = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get checked() {
      return checked();
    },
  };

  function handleClick(event: MouseEvent) {
    const details = createChangeEventDetails(
      REASONS.itemPress,
      event,
      undefined,
      {
        preventUnmountOnClose: NOOP,
      },
    ) as MenuRadioGroup.ChangeEventDetails;

    group.setValue(componentProps.value, details);
  }

  // A component boundary: the children are created under the context provider below, and the
  // element creation stays untracked.
  const Element = () =>
    renderElement("div", componentProps, {
      state,
      stateAttributesMapping: itemMapping,
      props: [
        createDynamicPropsSource(() => store.select("itemProps")),
        {
          role: "menuitemradio",
          get "aria-checked"() {
            return checked();
          },
          onClick: handleClick,
        },
        elementProps,
        getItemProps,
      ],
      ref: [itemRef, listItem.ref],
    });

  return (
    <MenuRadioItemContext value={state}>
      <Element />
    </MenuRadioItemContext>
  );
}

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItem(props: MenuRadioItem.Props): JSX.Element {
  return renderFilteredItem(props, MenuRadioItemPlain);
}

export interface MenuRadioItemState {
  /**
   * Whether the radio item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the radio item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
}

export interface MenuRadioItemProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<"div", MenuRadioItemState>, "id"> {
  /**
   * Value of the radio item.
   * This is the value that will be set in the MenuRadioGroup when the item is selected.
   */
  value: any;
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
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuRadioItem {
  export type State = MenuRadioItemState;
  export type Props = MenuRadioItemProps;
}
