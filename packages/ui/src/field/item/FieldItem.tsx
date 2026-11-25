import { omit } from 'solid-js';
import type { FieldRootState } from '../root/FieldRoot';
import {
  extendFieldRootState,
  useFieldRootContext,
} from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { FieldItemContext, type FieldItemContextValue } from './FieldItemContext';
import { LabelableProvider } from '../../internals/labelable-provider/LabelableProvider';

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldItem(componentProps: FieldItem.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled');

  const field = useFieldRootContext(false);

  const disabled = () => (field.disabled() ?? false) || (componentProps.disabled ?? false);
  const state: FieldItemState = extendFieldRootState(field.state, {
    get disabled() {
      return disabled();
    },
  });

  const context: FieldItemContextValue = { disabled };

  return (
    <LabelableProvider>
      <FieldItemContext value={context}>
        {renderElement('div', componentProps, {
          state,
          props: elementProps,
          stateAttributesMapping: fieldValidityMapping,
        })}
      </FieldItemContext>
    </LabelableProvider>
  );
}

export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps extends BaseUIComponentProps<'div', FieldItemState> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props = FieldItemProps;
}
