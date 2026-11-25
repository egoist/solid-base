import type { JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { popupStateMapping } from '../popupStateMapping';
import { renderElement } from '../../../internals/renderElement';
import type { RenderElementComponentProps } from '../../../internals/renderElement';
import { getDisabledMountTransitionStyles } from '../../../internals/getDisabledMountTransitionStyles';
import type { TransitionStatus } from '../../../internals/transitionStatus';
import type { HTMLProps } from '../../../internals/types';

/**
 * Options of `renderPositioner`. Read lazily: pass getters for reactive values.
 */
export interface RenderPositionerOptions {
  /** The positioning styles (`positionerStyles` of `createAnchorPositioning`). */
  styles: JSX.CSSProperties;
  transitionStatus: TransitionStatus;
  /** The part's element props (a live object, such as the result of `omit`). Read once. */
  props?: HTMLProps | undefined;
  /** Internal refs. The user's ref flows through `props`. Read once. */
  ref?: RefProp<HTMLDivElement> | undefined;
  hidden?: boolean | undefined;
  inert?: boolean | undefined;
}

/**
 * Renders the shared outer Positioner element used by popup components.
 * Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
 */
export function renderPositioner<State extends Record<string, any>>(
  componentProps: RenderElementComponentProps<State>,
  state: State,
  options: RenderPositionerOptions,
): JSX.Element {
  const positionerProps: HTMLProps = {
    role: 'presentation',
    get hidden() {
      return options.hidden;
    },
    get style() {
      const style: JSX.CSSProperties = { ...options.styles };
      if (options.inert ?? false) {
        style['pointer-events'] = 'none';
      }
      return style;
    },
  };

  const transitionProps: HTMLProps = {
    get style() {
      return getDisabledMountTransitionStyles(options.transitionStatus).style;
    },
  };

  return renderElement('div', componentProps, {
    state,
    ref: options.ref,
    props: [positionerProps, transitionProps, options.props],
    stateAttributesMapping: popupStateMapping,
  });
}
