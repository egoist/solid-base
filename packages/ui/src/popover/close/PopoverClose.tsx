import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { renderElement } from '../../internals/renderElement';
import { createButton } from '../../internals/use-button/createButton';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createClosePartRegistration } from '../utils/closePart';

/**
 * A button that closes the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverClose(componentProps: PopoverClose.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'nativeButton');

  const disabled = () => componentProps.disabled ?? false;

  const { buttonRef, getButtonProps } = createButton({
    disabled,
    focusableWhenDisabled: () => false,
    native: () => componentProps.nativeButton ?? true,
  });

  const store = usePopoverRootContext();
  createClosePartRegistration();

  return renderElement('button', componentProps, {
    ref: buttonRef,
    props: [
      {
        onClick(event: MouseEvent) {
          store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
        },
      },
      elementProps,
      getButtonProps,
    ],
  });
}

export interface PopoverCloseState {}

export interface PopoverCloseProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', PopoverCloseState>, 'disabled'> {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace PopoverClose {
  export type State = PopoverCloseState;
  export type Props = PopoverCloseProps;
}
