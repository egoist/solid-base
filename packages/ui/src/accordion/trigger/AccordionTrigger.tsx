import { omit } from 'solid-js';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { createButton } from '../../internals/use-button/createButton';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { renderElement } from '../../internals/renderElement';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { registerCollapsiblePartId } from '../../collapsible/panel/registerCollapsiblePartId';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';

const stateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...accordionStateAttributesMapping,
  ...triggerOpenStateMapping,
};

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Solid Base Accordion](https://base.egoist.dev/components/accordion)
 */
export function AccordionTrigger(componentProps: AccordionTrigger.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'id',
    'nativeButton',
  );

  const collapsible = useCollapsibleRootContext();

  const disabled = () => (componentProps.disabled || collapsible.disabled()) ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const itemContext = useAccordionItemContext();
  const registeredId = () => componentProps.id || undefined;
  const id = () => registeredId() ?? itemContext.defaultTriggerId();

  registerCollapsiblePartId(registeredId, itemContext.setTriggerId);

  const itemState = itemContext.state;
  const state: AccordionTriggerState = {
    get value() {
      return itemState.value;
    },
    get orientation() {
      return itemState.orientation;
    },
    get hidden() {
      return itemState.hidden;
    },
    get index() {
      return itemState.index;
    },
    get open() {
      return itemState.open;
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
          return collapsible.open() ? collapsible.panelId() : undefined;
        },
        get 'aria-expanded'() {
          return collapsible.open();
        },
        get id() {
          return id();
        },
        onClick: (event: MouseEvent) => collapsible.handleTrigger(event),
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });
}

export interface AccordionTriggerState extends AccordionItemState {}

export interface AccordionTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', AccordionTriggerState> {}

export namespace AccordionTrigger {
  export type State = AccordionTriggerState;
  export type Props = AccordionTriggerProps;
}
