import { omit } from 'solid-js';
import type { SwitchRootState } from '../root/SwitchRoot';
import { useSwitchRootContext } from '../root/SwitchRootContext';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { stateAttributesMapping } from '../stateAttributesMapping';

/**
 * The movable part of the switch that indicates whether the switch is on or off.
 * Renders a `<span>`.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchThumb(componentProps: SwitchThumb.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const state = useSwitchRootContext();

  return renderElement('span', componentProps, {
    state,
    stateAttributesMapping,
    props: elementProps,
  });
}

export interface SwitchThumbProps extends BaseUIComponentProps<'span', SwitchThumbState> {}

export interface SwitchThumbState extends SwitchRootState {}

export namespace SwitchThumb {
  export type Props = SwitchThumbProps;
  export type State = SwitchThumbState;
}
