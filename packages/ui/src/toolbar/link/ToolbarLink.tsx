import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';

const TOOLBAR_LINK_METADATA: ToolbarRoot.ItemMetadata = {
  // Links cannot be disabled, but they still occupy a focusable composite item slot.
  disabled: false,
  focusableWhenDisabled: true,
};

/**
 * A link component.
 * Renders an `<a>` element.
 *
 * Documentation: [Solid Base Toolbar](https://base.egoist.dev/components/toolbar)
 */
export function ToolbarLink(componentProps: ToolbarLink.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const toolbarContext = useToolbarRootContext();

  const state: ToolbarLinkState = {
    get orientation() {
      return toolbarContext.orientation;
    },
  };

  return (
    <CompositeItem
      tag="a"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      metadata={TOOLBAR_LINK_METADATA}
      state={state}
      props={[elementProps]}
    />
  );
}

export interface ToolbarLinkState {
  /**
   * The component orientation.
   */
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarLinkProps extends BaseUIComponentProps<'a', ToolbarLinkState> {}

export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props = ToolbarLinkProps;
}
