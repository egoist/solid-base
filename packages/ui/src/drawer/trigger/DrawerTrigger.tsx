import type { JSX } from '@solidjs/web';
import { DialogTrigger } from '../../dialog/trigger/DialogTrigger';
import type { DialogTriggerProps, DialogTriggerState } from '../../dialog/trigger/DialogTrigger';
import type { DrawerHandle } from '../handle';

/**
 * A button that opens the drawer.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Drawer](https://base.egoist.dev/components/drawer)
 */
export const DrawerTrigger = DialogTrigger as DrawerTrigger;

export interface DrawerTrigger {
  <Payload>(componentProps: DrawerTriggerProps<Payload>): JSX.Element;
}

export interface DrawerTriggerProps<Payload = unknown> extends Omit<
  DialogTriggerProps<Payload>,
  'handle'
> {
  /**
   * A handle to associate the trigger with a drawer.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
}

export interface DrawerTriggerState extends DialogTriggerState {}

export namespace DrawerTrigger {
  export type Props<Payload = unknown> = DrawerTriggerProps<Payload>;
  export type State = DrawerTriggerState;
}
