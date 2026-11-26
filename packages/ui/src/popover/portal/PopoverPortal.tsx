import { Show, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortal, type PortalContainer } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { PopoverPortalContext } from './PopoverPortalContext';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverPortal(props: PopoverPortal.Props): JSX.Element {
  const portalProps = omit(props, 'keepMounted');
  const keepMounted = () => props.keepMounted ?? false;

  const store = usePopoverRootContext();

  return (
    <Show when={store.select('mounted') || keepMounted()}>
      <PopoverPortalContext value={keepMounted}>
        <FloatingPortal {...portalProps} />
      </PopoverPortalContext>
    </Show>
  );
}

export interface PopoverPortalState {}

export interface PopoverPortalProps extends BaseUIComponentProps<'div', PopoverPortalState> {
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

export namespace PopoverPortal {
  export type State = PopoverPortalState;
  export type Props = PopoverPortalProps;
}
