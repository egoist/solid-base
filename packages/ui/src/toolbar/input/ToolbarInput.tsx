import { omit } from 'solid-js';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { createFocusableWhenDisabled } from '../../utils/focusableWhenDisabled';
import type { ToolbarRoot, ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Solid Base Toolbar](https://base.egoist.dev/components/toolbar)
 */
export function ToolbarInput(componentProps: ToolbarInput.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'focusableWhenDisabled',
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

  const focusableWhenDisabledProps = createFocusableWhenDisabled({
    composite: () => true,
    disabled,
    focusableWhenDisabled,
    isNativeButton: () => false,
  });

  const state: ToolbarInputState = {
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

  const preventWhenDisabled = (event: Event) => {
    if (disabled()) {
      event.preventDefault();
    }
  };

  const defaultProps: HTMLProps = {
    onClick: preventWhenDisabled,
    onPointerDown: preventWhenDisabled,
  };

  return (
    <CompositeItem
      tag="input"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      metadata={itemMetadata}
      state={state}
      props={[defaultProps, elementProps, focusableWhenDisabledProps]}
    />
  );
}

export interface ToolbarInputState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarInputProps extends BaseUIComponentProps<'input', ToolbarInputState> {
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

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props = ToolbarInputProps;
}
