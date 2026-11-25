import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { createButton } from '../../internals/use-button/createButton';
import { renderElement } from '../../internals/renderElement';

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastClose(componentProps: ToastClose.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'nativeButton');

  const store = useToastProviderContext();
  const rootContext = useToastRootContext();

  const [hasFocus, setHasFocus] = createSignal(false);

  const { getButtonProps, buttonRef } = createButton({
    disabled: () => componentProps.disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const state: ToastClose.State = {
    get type() {
      return rootContext.toast.type;
    },
  };

  return renderElement('button', componentProps, {
    ref: buttonRef,
    state,
    props: [
      {
        get 'aria-hidden'() {
          return !rootContext.expanded && !hasFocus() ? 'true' : 'false';
        },
        onClick() {
          store.closeToast(rootContext.toast.id);
        },
        onFocus() {
          setHasFocus(true);
        },
        onBlur() {
          setHasFocus(false);
        },
      },
      elementProps,
      getButtonProps,
    ],
  });
}

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', ToastCloseState>, 'disabled'> {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ToastClose {
  export type State = ToastCloseState;
  export type Props = ToastCloseProps;
}
