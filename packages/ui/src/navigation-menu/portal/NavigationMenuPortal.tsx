import { Show, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortal, type PortalContainer } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { NavigationMenuPortalContext } from './NavigationMenuPortalContext';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPortal(props: NavigationMenuPortal.Props): JSX.Element {
  const portalProps = omit(props, 'keepMounted');
  const keepMounted = () => props.keepMounted ?? false;

  const context = useNavigationMenuRootContext();

  return (
    <Show when={context.mounted || keepMounted()}>
      <NavigationMenuPortalContext value={keepMounted}>
        <FloatingPortal {...portalProps} />
      </NavigationMenuPortalContext>
    </Show>
  );
}

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalProps extends BaseUIComponentProps<
  'div',
  NavigationMenuPortalState
> {
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

export namespace NavigationMenuPortal {
  export type State = NavigationMenuPortalState;
  export type Props = NavigationMenuPortalProps;
}
