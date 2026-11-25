import { omit } from 'solid-js';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { createButton } from '../../internals/use-button/createButton';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';

const stateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsibleTrigger(componentProps: CollapsibleTrigger.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'nativeButton');

  const context = useCollapsibleRootContext();

  const disabled = () => (componentProps.disabled || context.disabled()) ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const state: CollapsibleTriggerState = {
    get open() {
      return context.state.open;
    },
    get transitionStatus() {
      return context.state.transitionStatus;
    },
    get disabled() {
      return disabled();
    },
  };

  return renderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [
      {
        get 'aria-controls'() {
          return context.open() ? context.panelId() : undefined;
        },
        get 'aria-expanded'() {
          return context.open();
        },
        onClick: (event: MouseEvent) => context.handleTrigger(event),
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });
}

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', CollapsibleTriggerState> {}

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props = CollapsibleTriggerProps;
}
