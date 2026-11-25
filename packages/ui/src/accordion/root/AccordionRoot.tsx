import { createEffect, omit } from 'solid-js';
import { isDev } from '@solidjs/web';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { EMPTY_ARRAY } from '@egoist/solid-base-utils/empty';
import { warn } from '@egoist/solid-base-utils/warn';
import type { BaseUIComponentProps, Orientation } from '../../internals/types';
import { CompositeList, createCompositeList } from '../../internals/composite/list/CompositeList';
import { renderElement } from '../../internals/renderElement';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import { AccordionRootContext, type AccordionRootContextValue } from './AccordionRootContext';

const rootStateAttributesMapping = {
  value: () => null,
};

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionRoot<Value = any>(componentProps: AccordionRoot.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'hiddenUntilFound',
    'keepMounted',
    'loopFocus',
    'onValueChange',
    'multiple',
    'orientation',
    'value',
    'defaultValue',
  );

  if (isDev) {
    createEffect(
      () => Boolean(componentProps.hiddenUntilFound) && componentProps.keepMounted === false,
      (shouldWarn) => {
        if (shouldWarn) {
          warn(
            'The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.',
          );
        }
      },
    );
  }

  const disabled = () => componentProps.disabled ?? false;
  const orientation = () => componentProps.orientation ?? 'vertical';

  const [value, setValue] = createControllableSignal<AccordionValue<Value>>({
    value: () => componentProps.value,
    defaultValue: () => componentProps.defaultValue ?? EMPTY_ARRAY,
  });

  function handleValueChange(
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    details: AccordionRoot.ChangeEventDetails,
  ) {
    const currentValue = value();
    let nextValue: AccordionRoot.Value<Value>;
    if (!componentProps.multiple) {
      nextValue = currentValue[0] === newValue ? [] : [newValue];
    } else if (nextOpen) {
      // Not `concat`: an item value can itself be an array, which `concat` would flatten.
      nextValue = [...currentValue, newValue];
    } else {
      nextValue = currentValue.filter((v) => v !== newValue);
    }

    componentProps.onValueChange?.(nextValue, details);
    if (details.isCanceled) {
      return;
    }
    setValue(nextValue);
  }

  const state: AccordionRoot.State<Value> = {
    get value() {
      return value();
    },
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const contextValue: AccordionRootContextValue<Value> = {
    disabled,
    handleValueChange,
    hiddenUntilFound: () => componentProps.hiddenUntilFound ?? false,
    keepMounted: () => componentProps.keepMounted ?? false,
    state,
    value,
  };

  const list = createCompositeList();

  return (
    <AccordionRootContext value={contextValue}>
      <CompositeList list={list}>
        {renderElement('div', componentProps, {
          state,
          props: elementProps,
          stateAttributesMapping: rootStateAttributesMapping,
        })}
      </CompositeList>
    </AccordionRootContext>
  );
}

export type AccordionValue<Value = any> = Value[];

export interface AccordionRootState<Value = any> {
  /**
   * The current value.
   * Treat it as read-only: it may be a shared frozen array when no value is set.
   */
  value: AccordionValue<Value>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The component orientation.
   *
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This state no longer affects keyboard focus behavior.
   * @deprecated
   */
  orientation: Orientation;
}

export interface AccordionRootProps<Value = any> extends BaseUIComponentProps<
  'div',
  AccordionRoot.State<Value>
> {
  /**
   * The controlled value of the item(s) that should be expanded.
   *
   * To render an uncontrolled accordion, use the `defaultValue` prop instead.
   */
  value?: AccordionValue<Value> | undefined;
  /**
   * The uncontrolled value of the item(s) that should be initially expanded.
   *
   * To render a controlled accordion, use the `value` prop instead.
   */
  defaultValue?: AccordionValue<Value> | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This prop no longer affects keyboard focus behavior.
   * @deprecated
   */
  loopFocus?: boolean | undefined;
  /**
   * Event handler called when an accordion item is expanded or collapsed.
   * Provides the new value as an argument.
   */
  onValueChange?:
    | ((value: AccordionValue<Value>, eventDetails: AccordionRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether multiple items can be open at the same time.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This prop no longer affects keyboard focus behavior.
   * @default 'vertical'
   * @deprecated
   */
  orientation?: Orientation | undefined;
}

export type AccordionRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionRootChangeEventDetails =
  BaseUIChangeEventDetails<AccordionRoot.ChangeEventReason>;

export namespace AccordionRoot {
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type State<TValue = any> = AccordionRootState<TValue>;
  export type Props<TValue = any> = AccordionRootProps<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}
