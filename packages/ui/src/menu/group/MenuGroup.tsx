import { createSignal, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useMenuFilterImpl } from "../filter-root/MenuFilterContext";
import type { BaseUIComponentProps } from "../../internals/types";
import { renderElement } from "../../internals/renderElement";
import { MenuGroupContext } from "./MenuGroupContext";

/**
 * The plain (unfiltered) implementation of `Menu.Group`.
 * @internal
 */
export function MenuGroupPlain(componentProps: MenuGroup.Props): JSX.Element {
  const elementProps = omit(componentProps, "render", "class", "style");

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });

  // A component boundary: the children are created under the context provider below, and the
  // element creation stays untracked.
  const Element = () =>
    renderElement("div", componentProps, {
      props: [
        {
          role: "group",
          get "aria-labelledby"() {
            return labelId();
          },
        },
        elementProps,
      ],
    });

  return (
    <MenuGroupContext value={(id) => setLabelId(id)}>
      <Element />
    </MenuGroupContext>
  );
}

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroup(props: MenuGroup.Props): JSX.Element {
  const impl = useMenuFilterImpl();
  if (impl) {
    const Group = impl.Group;
    return <Group {...props} />;
  }
  return <MenuGroupPlain {...props} />;
}

export interface MenuGroupProps extends BaseUIComponentProps<
  "div",
  MenuGroupState
> {}

export interface MenuGroupState {}

export namespace MenuGroup {
  export type Props = MenuGroupProps;
  export type State = MenuGroupState;
}
