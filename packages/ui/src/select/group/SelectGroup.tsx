import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { SelectGroupContext } from './SelectGroupContext';
import { renderElement } from '../../internals/renderElement';

/**
 * Groups related select items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Select](https://base.egoist.dev/components/select)
 */
export function SelectGroup(componentProps: SelectGroup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style');

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);

  const contextValue: SelectGroupContext = {
    labelId,
    setLabelId: (next) => setLabelId(next as any),
  };

  // A component boundary keeps the element creation untracked, inside the provider.
  const Element = () =>
    renderElement('div', componentProps, {
      props: [
        {
          role: 'group',
          get 'aria-labelledby'() {
            return labelId();
          },
        },
        elementProps,
      ],
    });

  return (
    <SelectGroupContext value={contextValue}>
      <Element />
    </SelectGroupContext>
  );
}

export interface SelectGroupState {}

export interface SelectGroupProps extends BaseUIComponentProps<'div', SelectGroupState> {}

export namespace SelectGroup {
  export type State = SelectGroupState;
  export type Props = SelectGroupProps;
}
