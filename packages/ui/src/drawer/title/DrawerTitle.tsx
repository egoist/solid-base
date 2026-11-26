import type { JSX } from '@solidjs/web';
import { DialogTitle } from '../../dialog/title/DialogTitle';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * A heading that labels the drawer.
 * Renders an `<h2>` element.
 *
 * Documentation: [Solid Base Drawer](https://base.egoist.dev/components/drawer)
 */
export const DrawerTitle = DialogTitle as DrawerTitle;

export interface DrawerTitleProps extends BaseUIComponentProps<'h2', DrawerTitleState> {}

export interface DrawerTitleState {}

export interface DrawerTitle {
  (componentProps: DrawerTitleProps): JSX.Element;
}

export namespace DrawerTitle {
  export type Props = DrawerTitleProps;
  export type State = DrawerTitleState;
}
