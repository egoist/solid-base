import type { JSX } from '@solidjs/web';
import { createDialogInteractions } from './useDialogRoot';
import { DialogRootContext, useDialogRootContext } from './DialogRootContext';
import { DialogStore } from '../store/DialogStore';
import type { DialogRootProps } from './DialogRoot';
import {
  attachPopupHandle,
  createPopupRoot,
  createPopupRootSync,
  renderPopupRootChildren,
} from '../../utils/popups/popupRoot';

export type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';

/**
 * Renders a Dialog-like Root (Dialog, AlertDialog, Drawer): creates its store, wires its
 * interactions and provides the context.
 */
export function renderDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
): JSX.Element {
  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const modal = () => (isAlertDialog ? true : (props.modal ?? true));
  const disablePointerDismissal = () =>
    isAlertDialog || (props.disablePointerDismissal ?? false);
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;

  const { store, open } = createPopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new DialogStore<Payload>({ ...initialState, nested, role }, defaultPopupId),
  );

  store.bind('modal', modal);
  store.bind('disablePointerDismissal', disablePointerDismissal);

  createPopupRootSync(store, open);

  // Attached before the children render; a new `handle` prop re-attaches the same store.
  attachPopupHandle(() => props.handle, store);

  createDialogInteractions(store, parentStore?.context, isDrawer);

  return (
    <DialogRootContext value={store as DialogStore<unknown>}>
      {renderPopupRootChildren<Payload>(props.children, () => store.select('payload') as Payload | undefined)}
    </DialogRootContext>
  );
}
