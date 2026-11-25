import { children as resolveChildren, createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { createButton } from '../../internals/use-button/createButton';
import { renderElement } from '../../internals/renderElement';
import { createDynamicPropsSource } from '../../utils/popups/popupStoreUtils';
import { isRenderableNode } from '../utils/isRenderableNode';

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastAction(componentProps: ToastAction.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'children',
  );

  const rootContext = useToastRootContext();

  const resolvedChildren = resolveChildren(() => componentProps.children);
  const computedChildren = () =>
    rootContext.toast.actionProps?.children ?? (resolvedChildren() as JSX.Element);
  const shouldRender = createMemo(() => isRenderableNode(computedChildren()));

  const { getButtonProps, buttonRef } = createButton({
    disabled: () => componentProps.disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const state: ToastAction.State = {
    get type() {
      return rootContext.toast.type;
    },
  };

  return renderElement('button', componentProps, {
    ref: buttonRef,
    state,
    enabled: shouldRender,
    props: [
      elementProps,
      createDynamicPropsSource(() => rootContext.toast.actionProps as HTMLProps | undefined),
      getButtonProps,
      {
        get children() {
          return computedChildren();
        },
      },
    ],
  });
}

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', ToastActionState>, 'disabled'> {
  /**
   * Whether the component ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}
