import type { JSX } from '@solidjs/web';
import {
  FloatingPortalLite,
  type PortalContainer,
} from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * A portal element that moves the viewport to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Toast](https://base.egoist.dev/components/toast)
 */
export function ToastPortal(props: ToastPortal.Props): JSX.Element {
  return <FloatingPortalLite {...props} />;
}

export interface ToastPortalState {}

export interface ToastPortalProps extends BaseUIComponentProps<'div', ToastPortalState> {
  /**
   * A parent element to render the portal element into.
   */
  container?: PortalContainer;
}

export namespace ToastPortal {
  export type State = ToastPortalState;
  export type Props = ToastPortalProps;
}
