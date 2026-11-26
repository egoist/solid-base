import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * A heading that labels the popover.
 * Renders an `<h2>` element.
 *
 * Documentation: [Solid Base Popover](https://base.egoist.dev/components/popover)
 */
export function PopoverTitle(componentProps: PopoverTitle.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const store = usePopoverRootContext();

  const id = createBaseUiId(() => componentProps.id as string | undefined);

  store.syncValueWithCleanup('titleElementId', id);

  return renderElement('h2', componentProps, {
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

export interface PopoverTitleState {}

export interface PopoverTitleProps extends BaseUIComponentProps<'h2', PopoverTitleState> {}

export namespace PopoverTitle {
  export type State = PopoverTitleState;
  export type Props = PopoverTitleProps;
}
