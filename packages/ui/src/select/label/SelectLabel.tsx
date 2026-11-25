import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { createLabel } from '../../internals/labelable-provider/createLabel';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import { useSelectRootContext } from '../root/SelectRootContext';

/**
 * An accessible label that is automatically associated with the select trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectLabel(componentProps: SelectLabel.Props): JSX.Element {
  // Keep the label id derived from the root and ignore runtime `id` overrides from untyped
  // consumers.
  const elementProps = omit(componentProps as SelectLabel.Props & { id?: string }, 'render', 'class', 'style', 'id');

  const field = useFieldRootContext();
  const store = useSelectRootContext();

  const labelProps = createLabel({
    id: () => getDefaultLabelId(store.select('id')),
    fallbackControlId: () => store.select('triggerElement')?.id ?? store.select('id'),
    setLabelId(nextLabelId) {
      const resolvedLabelId =
        typeof nextLabelId === 'function' ? nextLabelId(store.state.labelId) : nextLabelId;
      store.set('labelId', resolvedLabelId);
    },
  });

  return renderElement('div', componentProps, {
    state: field.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export type SelectLabelState = FieldRoot.State;

export interface SelectLabelProps extends Omit<BaseUIComponentProps<'div', SelectLabel.State>, 'id'> {}

export namespace SelectLabel {
  export type State = SelectLabelState;
  export type Props = SelectLabelProps;
}
