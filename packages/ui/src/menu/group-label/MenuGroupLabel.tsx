import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import { createBaseUiId } from '../../internals/baseUiId';
import { useMenuGroupRootContext } from '../group/MenuGroupContext';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroupLabel(componentProps: MenuGroupLabel.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id');

  const id = createBaseUiId(() => componentProps.id);

  const setLabelId = useMenuGroupRootContext();

  createEffect(id, (currentId) => {
    setLabelId(currentId);
    return () => {
      setLabelId((current) => (current === currentId ? undefined : current));
    };
  });

  return renderElement('div', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
  });
}

export interface MenuGroupLabelProps
  extends Omit<BaseUIComponentProps<'div', MenuGroupLabelState>, 'id'> {
  id?: string | undefined;
}

export interface MenuGroupLabelState {}

export namespace MenuGroupLabel {
  export type Props = MenuGroupLabelProps;
  export type State = MenuGroupLabelState;
}
