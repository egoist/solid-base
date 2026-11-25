import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { createElementRegistration } from '../utils/createElementRegistration';

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaCorner(componentProps: ScrollAreaCorner.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const { cornerRef, cornerSize, hiddenState } = useScrollAreaRootContext();

  const shouldRender = () => !hiddenState().corner;
  const registration = createElementRegistration<HTMLDivElement>(() => cornerRef, shouldRender);

  return renderElement('div', componentProps, {
    ref: registration.ref,
    props: [
      {
        'aria-hidden': 'true',
        get style(): JSX.CSSProperties {
          return {
            position: 'absolute',
            bottom: '0px',
            'inset-inline-end': '0px',
            width: `${cornerSize().width}px`,
            height: `${cornerSize().height}px`,
          };
        },
      },
      elementProps,
    ],
    enabled: shouldRender,
  });
}

export interface ScrollAreaCornerState {}

export interface ScrollAreaCornerProps extends BaseUIComponentProps<'div', ScrollAreaCornerState> {}

export namespace ScrollAreaCorner {
  export type State = ScrollAreaCornerState;
  export type Props = ScrollAreaCornerProps;
}
