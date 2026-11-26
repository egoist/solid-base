import { omit } from 'solid-js';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { createRegisteredLabelId } from '../../utils/createRegisteredLabelId';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
import type { ProgressRootState } from '../root/ProgressRoot';

/**
 * An accessible label for the progress bar.
 * Renders a `<span>` element.
 *
 * Documentation: [Solid Base Progress](https://base.egoist.dev/components/progress)
 */
export function ProgressLabel(componentProps: ProgressLabel.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const { setLabelId, state } = useProgressRootContext();

  const id = createRegisteredLabelId(
    () => (componentProps.id === false ? undefined : componentProps.id),
    setLabelId,
  );

  return renderElement('span', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
        role: 'presentation',
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressLabelState extends ProgressRootState {}

export interface ProgressLabelProps extends BaseUIComponentProps<'span', ProgressLabelState> {}

export namespace ProgressLabel {
  export type State = ProgressLabelState;
  export type Props = ProgressLabelProps;
}
