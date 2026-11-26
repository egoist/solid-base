import { createSignal, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { createControllableSignal } from "@egoist/solid-base-utils/controlled";
import { useMenuFilterImpl } from "../filter-root/MenuFilterContext";
import { MenuRadioGroupContext } from "./MenuRadioGroupContext";
import { MenuGroupContext } from "../group/MenuGroupContext";
import { renderElement } from "../../internals/renderElement";
import type { BaseUIComponentProps } from "../../internals/types";
import type { MenuRoot } from "../root/MenuRoot";

/**
 * The plain (unfiltered) implementation of `Menu.RadioGroup`.
 * @internal
 */
export function MenuRadioGroupPlain(
  componentProps: MenuRadioGroup.Props,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    "render",
    "class",
    "style",
    "value",
    "defaultValue",
    "onValueChange",
    "disabled",
    "aria-labelledby",
  );

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);

  const [value, setValueUnwrapped] = createControllableSignal<any>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue,
  });

  const disabled = () => componentProps.disabled ?? false;

  function setValue(
    newValue: any,
    eventDetails: MenuRadioGroup.ChangeEventDetails,
  ) {
    componentProps.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(newValue);
  }

  const state: MenuRadioGroup.State = {
    get disabled() {
      return disabled();
    },
  };

  // A component boundary: the children are created under the context provider below, and the
  // element creation stays untracked.
  const Element = () =>
    renderElement("div", componentProps, {
      state,
      props: [
        {
          role: "group",
          get "aria-labelledby"() {
            return (
              (componentProps["aria-labelledby"] as string | undefined) ??
              labelId()
            );
          },
          get "aria-disabled"() {
            return disabled() || undefined;
          },
        },
        elementProps,
      ],
    });

  const context: MenuRadioGroupContext = {
    get value() {
      return value();
    },
    setValue,
    get disabled() {
      return disabled();
    },
  };

  return (
    <MenuGroupContext value={(id) => setLabelId(id)}>
      <MenuRadioGroupContext value={context}>
        <Element />
      </MenuRadioGroupContext>
    </MenuGroupContext>
  );
}

/**
 * Groups related radio items.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Menu](https://base.egoist.dev/components/menu)
 */
export function MenuRadioGroup<Value = any>(
  props: MenuRadioGroup.Props<Value>,
): JSX.Element {
  const impl = useMenuFilterImpl();
  if (impl) {
    const RadioGroup = impl.RadioGroup;
    return <RadioGroup {...props} />;
  }
  return <MenuRadioGroupPlain {...props} />;
}

export interface MenuRadioGroupProps<Value = any> extends BaseUIComponentProps<
  "div",
  MenuRadioGroupState
> {
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio item that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Function called when the selected value changes.
   */
  onValueChange?:
    | ((value: Value, eventDetails: MenuRadioGroup.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the component should ignore user interaction.
   *
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenuRadioGroupState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export type MenuRadioGroupChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuRadioGroupChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuRadioGroup {
  export type Props<Value = any> = MenuRadioGroupProps<Value>;
  export type State = MenuRadioGroupState;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}
