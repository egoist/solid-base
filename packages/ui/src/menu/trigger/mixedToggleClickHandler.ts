import { ownerDocument } from '@egoist/solid-base-utils/owner';
import type { BaseUIEvent, HTMLProps } from '../../internals/types';

/**
 * Returns `click` and `mousedown` handlers that fix the behavior of triggers of popups that are
 * toggled by different events. For example, a button that opens a popup on mousedown and closes
 * it on click. It prevents the popup from closing immediately after the mouse button is released.
 *
 * Parameters are read lazily (pass getters for reactive values).
 */
export function createMixedToggleClickHandler(
  params: CreateMixedToggleClickHandlerParameters,
): HTMLProps {
  let ignoreClick = false;

  return {
    onMouseDown(event: MouseEvent) {
      if (!(params.enabled ?? true)) {
        return;
      }
      const open = params.open;
      const mouseDownAction = params.mouseDownAction;
      if ((mouseDownAction === 'open' && !open) || (mouseDownAction === 'close' && open)) {
        ignoreClick = true;

        ownerDocument(event.currentTarget as Element).addEventListener(
          'click',
          () => {
            ignoreClick = false;
          },
          { once: true },
        );
      }
    },
    onClick(event: BaseUIEvent<MouseEvent>) {
      if (!(params.enabled ?? true)) {
        return;
      }
      if (ignoreClick) {
        ignoreClick = false;
        event.preventBaseUIHandler();
      }
    },
  };
}

export interface CreateMixedToggleClickHandlerParameters {
  /**
   * Whether the mixed toggle click handler is enabled.
   * @default true
   */
  readonly enabled?: boolean | undefined;
  /**
   * Determines what action is performed on mousedown.
   */
  readonly mouseDownAction: 'open' | 'close';
  /**
   * The current open state of the popup.
   */
  readonly open: boolean;
}
