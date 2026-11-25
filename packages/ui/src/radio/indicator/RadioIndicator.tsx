import { merge, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { RadioRootState } from '../root/RadioRoot';
import { useRadioRootContext } from '../root/RadioRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { createOpenChangeComplete } from '../../internals/openChangeComplete';
import {
  createTransitionStatus,
  type TransitionStatus,
} from '../../internals/transitionStatus';

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio-group)
 */
export function RadioIndicator(componentProps: RadioIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted');

  const rootState = useRadioRootContext();

  const rendered = () => rootState.checked;

  const { mounted, transitionStatus, setMounted } = createTransitionStatus(rendered);

  const state: RadioIndicatorState = merge(rootState, {
    get transitionStatus() {
      return transitionStatus();
    },
  });

  let indicatorElement: HTMLElement | null = null;

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

  return renderElement('span', componentProps, {
    ref: (element: HTMLElement) => {
      indicatorElement = element;
    },
    state,
    props: elementProps,
    stateAttributesMapping,
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
  });
}

export interface RadioIndicatorProps extends BaseUIComponentProps<'span', RadioIndicatorState> {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace RadioIndicator {
  export type Props = RadioIndicatorProps;
  export type State = RadioIndicatorState;
}
