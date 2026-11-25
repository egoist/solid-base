import { merge, omit, untrack } from 'solid-js';
import { useCheckboxRootContext } from '../root/CheckboxRootContext';
import { renderElement } from '../../internals/renderElement';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import type { BaseUIComponentProps } from '../../internals/types';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxIndicator(componentProps: CheckboxIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted');

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState.checked || rootState.indeterminate;

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  let indicatorElement: HTMLElement | null = null;

  const state: CheckboxIndicatorState = merge(rootState, {
    get transitionStatus() {
      return transitionStatus();
    },
  });

  createOpenChangeComplete({
    enabled: () => !rendered(),
    open: rendered,
    // Read when `rendered` changes; the element exists by then.
    element: () => indicatorElement,
    onComplete() {
      if (!untrack(rendered)) {
        setMounted(false);
      }
    },
  });

  const stateAttributesMapping: StateAttributesMapping<CheckboxIndicatorState> = {
    ...getCheckboxStateAttributesMapping(rootState),
    ...transitionStatusMapping,
  };

  return renderElement('span', componentProps, {
    ref: (element: HTMLElement) => {
      indicatorElement = element;
    },
    state,
    stateAttributesMapping,
    props: elementProps,
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
  });
}

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorProps extends BaseUIComponentProps<
  'span',
  CheckboxIndicatorState
> {
  /**
   * Whether to keep the element in the DOM when the checkbox is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props = CheckboxIndicatorProps;
}
