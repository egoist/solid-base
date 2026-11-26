import { createSignal, omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { createBaseUiId } from '../../internals/baseUiId';
import { renderElement } from '../../internals/renderElement';
import { useCompositeListItem } from '../../internals/composite/list/CompositeList';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import { createCollapsibleRoot } from '../../collapsible/root/createCollapsibleRoot';
import type { CollapsibleRoot } from '../../collapsible/root/CollapsibleRoot';
import {
  CollapsibleRootContext,
  type CollapsibleRootContextValue,
} from '../../collapsible/root/CollapsibleRootContext';
import type { AccordionRootState } from '../root/AccordionRoot';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import { AccordionItemContext, type AccordionItemContextValue } from './AccordionItemContext';
import { accordionStateAttributesMapping } from './stateAttributesMapping';

/**
 * Groups an accordion header with the corresponding panel.
 * Renders a `<div>` element.
 *
 * Documentation: [Solid Base Accordion](https://base.egoist.dev/components/accordion)
 */
export function AccordionItem(componentProps: AccordionItem.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'onOpenChange',
    'value',
  );

  const { ref: listItemRef, index } = useCompositeListItem();

  const rootContext = useAccordionRootContext();

  const fallbackValue = createBaseUiId();
  const value = () => componentProps.value ?? fallbackValue();

  const disabled = () => (componentProps.disabled ?? false) || rootContext.disabled();

  const isOpen = () => rootContext.value().includes(value());

  const onOpenChange = (nextOpen: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => {
    componentProps.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    rootContext.handleValueChange(value(), nextOpen, eventDetails);
  };

  const collapsible = createCollapsibleRoot({
    open: isOpen,
    onOpenChange,
    disabled,
  });

  const collapsibleContext: CollapsibleRootContextValue = {
    ...collapsible,
    onOpenChange,
    state: {
      get open() {
        return collapsible.open();
      },
      get disabled() {
        return collapsible.disabled();
      },
      get transitionStatus() {
        return collapsible.transitionStatus();
      },
    },
  };

  const state: AccordionItemState = {
    get value() {
      return rootContext.state.value;
    },
    get orientation() {
      return rootContext.state.orientation;
    },
    get hidden() {
      return !isOpen() && !collapsible.mounted();
    },
    get index() {
      return index();
    },
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpen();
    },
  };

  const defaultTriggerId = createBaseUiId();
  // `undefined` uses the initial generated fallback; `null` means the trigger unmounted.
  const [registeredTriggerId, setTriggerId] = createSignal<string | null | undefined>(undefined);
  const triggerId = () => {
    const registered = registeredTriggerId();
    return registered === null ? undefined : (registered ?? defaultTriggerId());
  };

  const accordionItemContext: AccordionItemContextValue = {
    defaultTriggerId,
    open: isOpen,
    state,
    setTriggerId,
    triggerId,
  };

  return (
    <CollapsibleRootContext value={collapsibleContext}>
      <AccordionItemContext value={accordionItemContext}>
        {renderElement('div', componentProps, {
          state,
          ref: listItemRef,
          props: elementProps,
          stateAttributesMapping: accordionStateAttributesMapping,
        })}
      </AccordionItemContext>
    </CollapsibleRootContext>
  );
}

export interface AccordionItemState extends AccordionRootState {
  /**
   * Whether the accordion item's panel is currently hidden.
   */
  hidden: boolean;
  /**
   * The item index.
   */
  index: number;
  /**
   * Whether the component is open.
   */
  open: boolean;
}

export interface AccordionItemProps extends BaseUIComponentProps<'div', AccordionItemState> {
  /**
   * A unique value that identifies this accordion item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the accordion programmatically, or to set an initial
   * open state.
   * @example
   * ```tsx
   * <Accordion.Root value={['a']}>
   *   <Accordion.Item value="a" /> // initially open
   *   <Accordion.Item value="b" /> // initially closed
   * </Accordion.Root>
   * ```
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: AccordionItem.ChangeEventDetails) => void)
    | undefined;
}

export type AccordionItemChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionItemChangeEventDetails =
  BaseUIChangeEventDetails<AccordionItem.ChangeEventReason>;

export namespace AccordionItem {
  export type State = AccordionItemState;
  export type Props = AccordionItemProps;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}
