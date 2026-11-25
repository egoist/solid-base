import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortal, type PortalContainer } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPortal(portalProps: SelectPortal.Props): JSX.Element {
  const store = useSelectRootContext();

  return (
    <Show when={store.select('mounted') || store.select('forceMounted')}>
      <FloatingPortal {...portalProps} />
    </Show>
  );
}

export interface SelectPortalState {}

export interface SelectPortalProps extends BaseUIComponentProps<'div', SelectPortalState> {
  /**
   * A parent element to render the portal element into.
   */
  container?: PortalContainer;
}

export namespace SelectPortal {
  export type State = SelectPortalState;
  export type Props = SelectPortalProps;
}
