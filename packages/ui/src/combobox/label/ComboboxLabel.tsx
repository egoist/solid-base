import { createEffect, omit } from 'solid-js';
import { isDev, type JSX } from '@solidjs/web';
import { error } from '@egoist/solid-base-utils/error';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { createLabel } from '../../internals/labelable-provider/createLabel';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Combobox](https://base.egoist.dev/components/combobox)
 */
export function ComboboxLabel(componentProps: ComboboxLabel.Props): JSX.Element {
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const elementProps = omit(
    componentProps as ComboboxLabel.Props & { id?: string | undefined },
    'render',
    'class',
    'style',
    'id',
  );

  const fieldRootContext = useFieldRootContext();
  const store = useComboboxRootContext();

  const inputInsidePopup = () => store.select('inputInsidePopup');

  if (isDev) {
    createEffect(
      () => [store.select('inputElement'), inputInsidePopup()] as const,
      ([inputElement, insidePopup]) => {
        if (!inputElement || insidePopup) {
          return;
        }

        error(
          '<Combobox.Label> labels <Combobox.Trigger> only. ' +
            'When <Combobox.Input> is the form control, use a native <label> or <Field.Label> instead.',
        );
      },
    );
  }

  const labelProps = createLabel({
    id: () => getDefaultLabelId(store.select('id')),
    fallbackControlId: () =>
      (store.select('triggerElement') as HTMLElement | null)?.id ??
      (inputInsidePopup() ? store.select('id') : undefined),
    setLabelId(nextLabelId) {
      const resolvedLabelId =
        typeof nextLabelId === 'function' ? nextLabelId(store.state.labelId) : nextLabelId;
      store.set('labelId', resolvedLabelId);
    },
  });

  return renderElement('div', componentProps, {
    state: fieldRootContext.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface ComboboxLabelState extends FieldRoot.State {}

export interface ComboboxLabelProps extends Omit<
  BaseUIComponentProps<'div', ComboboxLabelState>,
  'id'
> {}

export namespace ComboboxLabel {
  export type State = ComboboxLabelState;
  export type Props = ComboboxLabelProps;
}
