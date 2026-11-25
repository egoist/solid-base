import { omit } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import {
  createLabel,
  focusElementWithVisible,
  getControlById,
} from '../../internals/labelable-provider/createLabel';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { SliderRoot } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderLabel(componentProps: SliderLabel.Props) {
  // Keep the label id derived from the root and ignore runtime `id` overrides from untyped
  // consumers.
  const elementProps = omit(componentProps as SliderLabel.Props & { id?: string }, 'render', 'class', 'style', 'id');

  const context = useSliderRootContext();

  function focusControl(event: MouseEvent, controlId: string | null | undefined) {
    if (controlId) {
      const controlElement = getControlById(event.currentTarget as Element, controlId);
      if (isHTMLElement(controlElement)) {
        focusElementWithVisible(controlElement);
        return;
      }
    }

    const fallbackInputs = context.controlRef.current?.querySelectorAll('input[type="range"]');
    const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
    if (isHTMLElement(fallbackInput)) {
      focusElementWithVisible(fallbackInput);
    }
  }

  const labelProps = createLabel({
    id: () => context.rootLabelId,
    setLabelId: context.setLabelId,
    focusControl,
  });

  return renderElement('div', componentProps, {
    state: context.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

export type SliderLabelState = SliderRoot.State;

export interface SliderLabelProps extends Omit<
  BaseUIComponentProps<'div', SliderLabel.State>,
  'id'
> {}

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props = SliderLabelProps;
}
