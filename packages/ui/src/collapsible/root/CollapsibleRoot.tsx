import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { renderElement } from '../../internals/renderElement';
import type { TransitionStatus } from '../../internals/transitionStatus';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import { createCollapsibleRoot } from './createCollapsibleRoot';
import { CollapsibleRootContext, type CollapsibleRootContextValue } from './CollapsibleRootContext';
import { collapsibleStateAttributesMapping } from './stateAttributesMapping';

/**
 * Groups all parts of the collapsible.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Collapsible](https://base.egoist.dev/components/collapsible)
 */
export function CollapsibleRoot(componentProps: CollapsibleRoot.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'defaultOpen',
    'disabled',
    'onOpenChange',
    'open',
  );

  const onOpenChange = (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => {
    componentProps.onOpenChange?.(open, eventDetails);
  };

  const collapsible = createCollapsibleRoot({
    open: () => componentProps.open,
    defaultOpen: () => componentProps.defaultOpen,
    onOpenChange,
    disabled: () => componentProps.disabled ?? false,
  });

  const state: CollapsibleRootState = {
    get open() {
      return collapsible.open();
    },
    get disabled() {
      return collapsible.disabled();
    },
    get transitionStatus() {
      return collapsible.transitionStatus();
    },
  };

  const contextValue: CollapsibleRootContextValue = {
    ...collapsible,
    onOpenChange,
    state,
  };

  return (
    <CollapsibleRootContext value={contextValue}>
      {renderElement('div', componentProps, {
        state,
        props: elementProps,
        stateAttributesMapping: collapsibleStateAttributesMapping,
      })}
    </CollapsibleRootContext>
  );
}

export interface CollapsibleRootState {
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsibleRootProps extends BaseUIComponentProps<'div', CollapsibleRootState> {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: boolean | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CollapsibleRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;
export type CollapsibleRootChangeEventDetails =
  BaseUIChangeEventDetails<CollapsibleRootChangeEventReason>;

export namespace CollapsibleRoot {
  export type State = CollapsibleRootState;
  export type Props = CollapsibleRootProps;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}
