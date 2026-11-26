import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/transitionStatus';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';

/**
 * A positioning container for the dialog popup that can be made scrollable.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Dialog](https://base.egoist.dev/components/dialog)
 */
export function DialogViewport(componentProps: DialogViewport.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const keepMounted = useDialogPortalContext();
  const store = useDialogRootContext();

  const open = () => store.select('open');
  const mounted = () => store.select('mounted');

  const state: DialogViewport.State = {
    get open() {
      return open();
    },
    get nested() {
      return store.select('nested');
    },
    get transitionStatus() {
      return store.select('transitionStatus');
    },
    get nestedDialogOpen() {
      return store.select('nestedOpenDialogCount') > 0;
    },
  };

  return renderElement('div', componentProps, {
    enabled: () => keepMounted() || mounted(),
    state,
    ref: (el: HTMLElement) => store.set('viewportElement', el),
    stateAttributesMapping: dialogStateAttributesMapping,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !mounted();
        },
        get style() {
          return open() ? undefined : { 'pointer-events': 'none' };
        },
      },
      elementProps,
    ],
  });
}

export interface DialogViewportState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within another dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export interface DialogViewportProps extends BaseUIComponentProps<'div', DialogViewportState> {}

export namespace DialogViewport {
  export type State = DialogViewportState;
  export type Props = DialogViewportProps;
}
