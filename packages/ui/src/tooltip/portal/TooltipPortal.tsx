import { Show, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortalLite, type PortalContainer } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPortalContext } from './TooltipPortalContext';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipPortal(props: TooltipPortal.Props): JSX.Element {
  const portalProps = omit(props, 'keepMounted');
  const keepMounted = () => props.keepMounted ?? false;

  const store = useTooltipRootContext();

  return (
    <Show when={store.select('mounted') || keepMounted()}>
      <TooltipPortalContext value={keepMounted}>
        <FloatingPortalLite {...portalProps} />
      </TooltipPortalContext>
    </Show>
  );
}

export interface TooltipPortalState {}

export interface TooltipPortalProps extends BaseUIComponentProps<'div', TooltipPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: PortalContainer;
}

export namespace TooltipPortal {
  export type State = TooltipPortalState;
  export type Props = TooltipPortalProps;
}
