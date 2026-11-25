import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefProp } from '@egoist/solid-base-utils/refs';
import { CompositeList, type CompositeMetadata } from '../list/CompositeList';
import { createCompositeRoot, type CompositeOnLoop } from './createCompositeRoot';
import { CompositeRootContext, type CompositeRootContextValue } from './CompositeRootContext';
import { renderElement, type RenderElementComponentProps } from '../../renderElement';
import type { IntrinsicTagName } from '../../types';
import type { PropsSource } from '../../../merge-props/mergeProps';
import type { ModifierKey } from '../composite';
import type { CompositeGridNavigator } from './gridNavigation';
import { useDirection } from '../../direction-context/DirectionContext';
import type { StateAttributesMapping } from '../../getStateAttributesProps';

/**
 * A container with roving focus over its composite items.
 * @internal
 */
export function CompositeRoot<State extends Record<string, any>>(
  componentProps: CompositeRoot.Props<State>,
) {
  const direction = useDirection();

  const composite = createCompositeRoot({
    grid: () => componentProps.grid,
    loopFocus: () => componentProps.loopFocus,
    onLoop: (...args) => componentProps.onLoop?.(...args) ?? args[2],
    orientation: () => componentProps.orientation,
    highlightedIndex: () => componentProps.highlightedIndex,
    onHighlightedIndexChange: (index) => componentProps.onHighlightedIndexChange?.(index),
    stopEventPropagation: () => componentProps.stopEventPropagation ?? true,
    enableHomeAndEndKeys: () => componentProps.enableHomeAndEndKeys,
    direction,
    disabledIndices: () => componentProps.disabledIndices,
    modifierKeys: () => componentProps.modifierKeys,
    onMapChange: (map) => componentProps.onMapChange?.(map),
  });

  const contextValue: CompositeRootContextValue = {
    highlightedIndex: composite.highlightedIndex,
    onHighlightedIndexChange: composite.onHighlightedIndexChange,
    highlightItemOnHover: () => componentProps.highlightItemOnHover ?? false,
    relayKeyboardEvent: composite.relayKeyboardEvent,
  };

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
    'orientation',
    'grid',
    'loopFocus',
    'onLoop',
    'highlightedIndex',
    'onHighlightedIndexChange',
    'enableHomeAndEndKeys',
    'onMapChange',
    'stopEventPropagation',
    'disabledIndices',
    'modifierKeys',
    'highlightItemOnHover',
    'compositeRef',
  );

  componentProps.compositeRef?.(contextValue);

  return (
    <CompositeRootContext value={contextValue}>
      <CompositeList list={composite.list}>
        {renderElement(componentProps.tag ?? 'div', componentProps, {
          state: componentProps.state,
          ref: [componentProps.ref, composite.rootRef],
          props: [composite.props, ...(componentProps.props ?? []), elementProps],
          stateAttributesMapping: componentProps.stateAttributesMapping,
        })}
      </CompositeList>
    </CompositeRootContext>
  );
}

export interface CompositeRootProps<State> extends RenderElementComponentProps<State> {
  [key: string]: any;
  children?: JSX.Element;
  /** Props sources for the rendered element, merged after the composite props. */
  props?: PropsSource<any>[] | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  ref?: RefProp<HTMLElement> | undefined;
  tag?: IntrinsicTagName | undefined;
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  grid?: CompositeGridNavigator | undefined;
  loopFocus?: boolean | undefined;
  onLoop?: CompositeOnLoop | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  enableHomeAndEndKeys?: boolean | undefined;
  onMapChange?: ((newMap: Map<HTMLElement, CompositeMetadata<any>>) => void) | undefined;
  stopEventPropagation?: boolean | undefined;
  disabledIndices?: number[] | undefined;
  modifierKeys?: ModifierKey[] | undefined;
  highlightItemOnHover?: boolean | undefined;
  /** Receives the composite context, e.g. to relay keyboard events from outside. */
  compositeRef?: ((context: CompositeRootContextValue) => void) | undefined;
}

export namespace CompositeRoot {
  export type Props<State> = CompositeRootProps<State>;
}
