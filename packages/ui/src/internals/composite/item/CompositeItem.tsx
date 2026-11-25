import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { renderElement, type RenderElementComponentProps } from '../../renderElement';
import { createCompositeItem } from './createCompositeItem';
import type { IntrinsicTagName } from '../../types';
import type { PropsSource } from '../../../merge-props/mergeProps';
import type { StateAttributesMapping } from '../../getStateAttributesProps';

/**
 * An item of a `CompositeRoot`.
 * @internal
 */
export function CompositeItem<Metadata, State extends Record<string, any>>(
  componentProps: CompositeItem.Props<Metadata, State>,
) {
  const { compositeProps, compositeRef } = createCompositeItem({
    metadata: componentProps.metadata,
  });

  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'ref',
    'props',
    'state',
    'stateAttributesMapping',
    'tag',
    'metadata',
  );

  return renderElement(componentProps.tag ?? 'div', componentProps, {
    state: componentProps.state,
    ref: [compositeRef, componentProps.ref],
    props: [compositeProps, ...(componentProps.props ?? []), elementProps],
    stateAttributesMapping: componentProps.stateAttributesMapping,
  });
}

export interface CompositeItemProps<Metadata, State> extends RenderElementComponentProps<State> {
  [key: string]: any;
  children?: JSX.Element;
  metadata?: Metadata | undefined;
  ref?: RefProp<HTMLElement> | undefined;
  props?: PropsSource<any>[] | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  tag?: IntrinsicTagName | undefined;
}

export namespace CompositeItem {
  export type Props<Metadata, State> = CompositeItemProps<Metadata, State>;
}
