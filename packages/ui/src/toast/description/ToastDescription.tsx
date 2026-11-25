import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createToastLabelPart } from '../utils/toastLabelPart';

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastDescription(componentProps: ToastDescription.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children');

  const { id, content, shouldRender, type } = createToastLabelPart(componentProps, 'description');

  const state: ToastDescription.State = {
    get type() {
      return type();
    },
  };

  return renderElement('p', componentProps, {
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

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionProps extends BaseUIComponentProps<'p', ToastDescriptionState> {}

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props = ToastDescriptionProps;
}
