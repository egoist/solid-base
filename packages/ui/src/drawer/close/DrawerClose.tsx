import type { JSX } from '@solidjs/web';
import { DialogClose } from '../../dialog/close/DialogClose';
import type { DialogCloseProps } from '../../dialog/close/DialogClose';

/**
 * A button that closes the drawer.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Drawer](https://base.egoist.dev/components/drawer)
 */
export const DrawerClose = DialogClose as DrawerClose;

export interface DrawerCloseProps extends DialogCloseProps {}

export interface DrawerCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export interface DrawerClose {
  (componentProps: DrawerCloseProps): JSX.Element;
}

export namespace DrawerClose {
  export type Props = DrawerCloseProps;
  export type State = DrawerCloseState;
}
