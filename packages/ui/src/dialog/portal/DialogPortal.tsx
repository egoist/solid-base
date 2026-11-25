import { Show, omit, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingPortal, type PortalContainer } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useDialogRootContext } from '../root/DialogRootContext';
import { DialogPortalContext } from './DialogPortalContext';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogPortal(props: DialogPortal.Props): JSX.Element {
  const portalProps = omit(props, 'keepMounted', 'children');
  const keepMounted = () => props.keepMounted ?? false;

  const store = useDialogRootContext();
  const mounted = () => store.select('mounted');

  return (
    <Show when={mounted() || keepMounted()}>
      <DialogPortalContext value={keepMounted}>
        <FloatingPortal {...portalProps}>
          <Show when={mounted() && store.select('modal') === true}>
            <DialogInternalBackdrop />
          </Show>
          {props.children}
        </FloatingPortal>
      </DialogPortalContext>
    </Show>
  );
}

/**
 * The transparent backdrop of a modal dialog, registered in the store so outside presses on it
 * dismiss the dialog.
 */
function DialogInternalBackdrop() {
  const store = useDialogRootContext();
  let element: HTMLDivElement | undefined;
  onCleanup(() => {
    if (store.context.internalBackdropElement === element) {
      store.context.internalBackdropElement = null;
    }
  });
  return (
    <InternalBackdrop
      ref={(el: HTMLDivElement) => {
        element = el;
        store.context.internalBackdropElement = el;
      }}
      inert={!store.select('open')}
    />
  );
}

export interface DialogPortalState {}

export interface DialogPortalProps extends BaseUIComponentProps<'div', DialogPortalState> {
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

export namespace DialogPortal {
  export type State = DialogPortalState;
  export type Props = DialogPortalProps;
}
