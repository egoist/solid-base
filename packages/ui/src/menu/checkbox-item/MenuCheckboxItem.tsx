import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { NOOP } from "@egoist/solid-base-utils/empty";
import { createControllableSignal } from "@egoist/solid-base-utils/controlled";
import { MenuCheckboxItemContext } from "./MenuCheckboxItemContext";
import { REGULAR_ITEM, createMenuItem } from "../item/createMenuItem";
import { useCompositeListItem } from "../../internals/composite/list/CompositeList";
import { useMenuRootContext } from "../root/MenuRootContext";
import { renderElement } from "../../internals/renderElement";
import { createBaseUiId } from "../../internals/baseUiId";
import type {
  BaseUIComponentProps,
  NonNativeButtonProps,
} from "../../internals/types";
import { itemMapping } from "../utils/stateAttributesMapping";
import { createChangeEventDetails } from "../../internals/createBaseUIEventDetails";
import { REASONS } from "../../internals/reasons";
import type { MenuRoot } from "../root/MenuRoot";
import { createDynamicPropsSource } from "../../utils/popups/popupStoreUtils";
import { renderFilteredItem } from "../item/filteredItem";

interface MenuCheckboxItemPlainProps extends MenuCheckboxItem.Props {
  /** The resolved checked state. */
  resolvedChecked: boolean;
  onResolvedCheckedChange: (
    checked: boolean,
    details: MenuCheckboxItem.ChangeEventDetails,
  ) => void;
}

function MenuCheckboxItemPlain(
  componentProps: MenuCheckboxItemPlainProps,
): JSX.Element {
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
    "checked",
    "defaultChecked",
    "onCheckedChange",
    "resolvedChecked",
    "onResolvedCheckedChange",
  );

  const { store } = useMenuRootContext();

  const listItem = useCompositeListItem({ label: () => componentProps.label });
  const id = createBaseUiId(() => componentProps.id);

  const highlighted = () => store.select("isActive", listItem.index());
  const disabled = () =>
    (componentProps.disabled ?? false) || store.select("disabled");
  const checked = () => componentProps.resolvedChecked;

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

  const state: MenuCheckboxItem.State = {
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
    ) as MenuCheckboxItem.ChangeEventDetails;

    componentProps.onResolvedCheckedChange(!checked(), details);
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
          role: "menuitemcheckbox",
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
    <MenuCheckboxItemContext value={state}>
      <Element />
    </MenuCheckboxItemContext>
  );
}

/**
 * A menu item that toggles a setting on or off.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItem(props: MenuCheckboxItem.Props): JSX.Element {
  // Owned above the element so an uncontrolled item keeps its state while a filter hides it.
  const [checked, setChecked] = createControllableSignal({
    value: () => props.checked,
    defaultValue: () => props.defaultChecked ?? false,
  });

  function handleCheckedChange(
    nextChecked: boolean,
    eventDetails: MenuCheckboxItem.ChangeEventDetails,
  ) {
    props.onCheckedChange?.(nextChecked, eventDetails);
    if (!eventDetails.isCanceled) {
      setChecked(nextChecked);
    }
  }

  const plainProps = {
    get resolvedChecked() {
      return checked();
    },
    onResolvedCheckedChange: handleCheckedChange,
  };

  return renderFilteredItem(
    merge(props, plainProps) as MenuCheckboxItemPlainProps,
    MenuCheckboxItemPlain,
  );
}

export interface MenuCheckboxItemState {
  /**
   * Whether the checkbox item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the checkbox item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
}

export interface MenuCheckboxItemProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<"div", MenuCheckboxItemState>, "id"> {
  /**
   * Whether the checkbox item is currently ticked.
   *
   * To render an uncontrolled checkbox item, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox item is initially ticked.
   *
   * To render a controlled checkbox item, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Event handler called when the checkbox item is ticked or unticked.
   */
  onCheckedChange?:
    | ((
        checked: boolean,
        eventDetails: MenuCheckboxItem.ChangeEventDetails,
      ) => void)
    | undefined;
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

export type MenuCheckboxItemChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuCheckboxItemChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuCheckboxItem {
  export type State = MenuCheckboxItemState;
  export type Props = MenuCheckboxItemProps;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}
