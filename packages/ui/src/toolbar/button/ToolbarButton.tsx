import { merge, omit } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { createButton } from '../../internals/use-button/createButton';
import type { ToolbarRoot, ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarButton(componentProps: ToolbarButton.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
  );

  const toolbarContext = useToolbarRootContext();
  const groupContext = useToolbarGroupContext();

  const disabled = () =>
    toolbarContext.disabled ||
    (groupContext?.disabled ?? false) ||
    (componentProps.disabled ?? false);
  const focusableWhenDisabled = () => componentProps.focusableWhenDisabled ?? true;

  const itemMetadata: ToolbarRoot.ItemMetadata = {
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
  };

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled,
    native: () => componentProps.nativeButton,
  });

  const state: ToolbarButtonState = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return toolbarContext.orientation;
    },
    get focusable() {
      return focusableWhenDisabled();
    },
  };

  return (
    <CompositeItem
      tag="button"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      metadata={itemMetadata}
      state={state}
      ref={buttonRef}
      props={[
        elementProps,
        // When a render prop is provided (typically another Base UI component
        // like Menu.Trigger), forward `disabled` so the rendered component can
        // derive its own disabled state. For the default toolbar button, avoid
        // forwarding a `disabled` prop so focusable disabled buttons remain
        // hoverable for interactions like tooltips.
        merge(() => (componentProps.render ? { disabled: disabled() } : {})),
        getButtonProps,
      ]}
    />
  );
}

export interface ToolbarButtonState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToolbarButtonState> {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props = ToolbarButtonProps;
}
