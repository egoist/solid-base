import type { JSX } from '@solidjs/web';
import { DialogPortal } from '../../dialog/portal/DialogPortal';
import type { DialogPortalProps } from '../../dialog/portal/DialogPortal';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Drawer](https://base.egoist.dev/components/drawer)
 */
export const DrawerPortal = DialogPortal as DrawerPortal;

export interface DrawerPortalState {}

export interface DrawerPortalProps extends DialogPortalProps {}

export interface DrawerPortal {
  (componentProps: DrawerPortalProps): JSX.Element;
}

export namespace DrawerPortal {
  export type Props = DrawerPortalProps;
  export type State = DrawerPortalState;
}
