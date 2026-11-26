import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createToastLabelPart } from '../utils/toastLabelPart';

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Solid Base Toast](https://base.egoist.dev/components/toast)
 */
export function ToastTitle(componentProps: ToastTitle.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children');

  const { id, content, shouldRender, type } = createToastLabelPart(componentProps, 'title');

  const state: ToastTitle.State = {
    get type() {
      return type();
    },
  };

  return renderElement('h2', componentProps, {
    state,
    enabled: shouldRender,
    props: [
      elementProps,
      {
        get id() {
          return id();
        },
        get children() {
          return content();
        },
      },
    ],
  });
}

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleProps extends BaseUIComponentProps<'h2', ToastTitleState> {}

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props = ToastTitleProps;
}
