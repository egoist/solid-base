import { createSignal, omit } from 'solid-js';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  FieldsetRootContext,
  useFieldsetRootContext,
  type FieldsetRootContextValue,
} from './FieldsetRootContext';

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Solid Base Fieldset](https://base.egoist.dev/components/fieldset)
 */
export function FieldsetRoot(componentProps: FieldsetRoot.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled');

  const [legendId, setLegendId] = createSignal<string | undefined>(undefined);

  const parent = useFieldsetRootContext(true);
  const disabled = () => (parent?.disabled() ?? false) || (componentProps.disabled ?? false);

  const state: FieldsetRootState = {
    get disabled() {
      return disabled();
    },
  };

  const context: FieldsetRootContextValue = {
    legendId,
    setLegendId: (next) => setLegendId(next as any),
    disabled,
  };

  return (
    <FieldsetRootContext value={context}>
      {renderElement('fieldset', componentProps, {
        state,
        props: [
          {
            get 'aria-labelledby'() {
              return legendId();
            },
            get disabled() {
              return disabled();
            },
          },
          elementProps,
        ],
      })}
    </FieldsetRootContext>
  );
}

export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetRootProps
  extends Omit<BaseUIComponentProps<'fieldset', FieldsetRootState>, 'disabled'> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldsetRoot {
  export type State = FieldsetRootState;
  export type Props = FieldsetRootProps;
}
