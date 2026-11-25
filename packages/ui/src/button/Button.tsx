import { omit } from 'solid-js';
import { createButton } from '../internals/use-button/createButton';
import { renderElement } from '../internals/renderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../internals/types';

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Button](https://base-ui.com/react/components/button)
 */
export function Button(componentProps: Button.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
  );

  const disabled = () => componentProps.disabled ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => componentProps.focusableWhenDisabled ?? false,
    native: () => componentProps.nativeButton ?? true,
  });

  const state: ButtonState = {
    get disabled() {
      return disabled();
    },
  };

  return renderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [elementProps, getButtonProps],
  });
}

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', ButtonState>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace Button {
  export type State = ButtonState;
  export type Props = ButtonProps;
}
