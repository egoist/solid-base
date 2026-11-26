import { omit } from 'solid-js';
import type { MeterRootState } from '../root/MeterRoot';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';

/**
 * Contains the meter indicator and represents the entire range of the meter.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Meter](https://base.egoist.dev/components/meter)
 */
export function MeterTrack(componentProps: MeterTrack.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  return renderElement('div', componentProps, {
    props: elementProps,
  });
}

export interface MeterTrackState extends MeterRootState {}

export interface MeterTrackProps extends BaseUIComponentProps<'div', MeterTrackState> {}

export namespace MeterTrack {
  export type State = MeterTrackState;
  export type Props = MeterTrackProps;
}
