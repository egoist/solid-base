import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * A paragraph with additional information about the popover.
 * Renders a `<p>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverDescription(componentProps: PopoverDescription.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const store = usePopoverRootContext();

  const id = createBaseUiId(() => componentProps.id as string | undefined);

  store.syncValueWithCleanup('descriptionElementId', id);

  return renderElement('p', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
  });
}

export interface PopoverDescriptionState {}

export interface PopoverDescriptionProps
  extends BaseUIComponentProps<'p', PopoverDescriptionState> {}

export namespace PopoverDescription {
  export type State = PopoverDescriptionState;
  export type Props = PopoverDescriptionProps;
}
