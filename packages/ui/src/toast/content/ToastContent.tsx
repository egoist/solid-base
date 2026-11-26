import { omit, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { renderElement } from '../../internals/renderElement';

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Toast](https://base.egoist.dev/components/toast)
 */
export function ToastContent(componentProps: ToastContent.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const rootContext = useToastRootContext();

  let contentElement: HTMLDivElement | null = null;

  onSettled(() => {
    rootContext.recalculateHeight();

    const node = contentElement;
    if (!node || typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => rootContext.recalculateHeight(true));
    const mutationObserver = new MutationObserver(() => rootContext.recalculateHeight(true));

    resizeObserver.observe(node);
    mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  });

  const state: ToastContent.State = {
    get expanded() {
      return rootContext.expanded;
    },
    get behind() {
      return rootContext.visibleIndex > 0;
    },
  };

  return renderElement('div', componentProps, {
    ref: (element: HTMLDivElement) => {
      contentElement = element;
    },
    state,
    props: elementProps,
  });
}

export interface ToastContentState {
  /**
   * Whether the toast viewport is expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast is behind the frontmost toast in the stack.
   */
  behind: boolean;
}

export interface ToastContentProps extends BaseUIComponentProps<'div', ToastContentState> {}

export namespace ToastContent {
  export type State = ToastContentState;
  export type Props = ToastContentProps;
}
