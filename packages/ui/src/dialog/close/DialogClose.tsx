import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { createButton } from '../../internals/use-button/createButton';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Dialog](https://base.egoist.dev/components/dialog)
 */
export function DialogClose(componentProps: DialogClose.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'nativeButton');

  const disabled = () => componentProps.disabled ?? false;

  const store = useDialogRootContext();

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const state: DialogClose.State = {
    get disabled() {
      return disabled();
    },
  };

  function handleClick(event: MouseEvent) {
    if (store.select('open')) {
      store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
    }
  }

  return renderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [{ onClick: handleClick }, elementProps, getButtonProps],
  });
}

export interface DialogCloseProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', DialogCloseState>, 'disabled'> {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;}

export interface DialogCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export namespace DialogClose {
  export type Props = DialogCloseProps;
  export type State = DialogCloseState;
}
