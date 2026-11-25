import { createEffect, omit } from 'solid-js';
import { isDev } from '@solidjs/web';
import { error } from '@egoist/solid-base-utils/error';
import { createControllableSignal } from '@egoist/solid-base-utils/controlled';
import { createBaseUiId } from '../internals/baseUiId';
import { renderElement } from '../internals/renderElement';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../internals/types';
import { useToggleGroupContext } from '../toggle-group/ToggleGroupContext';
import type { ToolbarRoot } from '../toolbar/root/ToolbarRoot';
import { createButton } from '../internals/use-button/createButton';
import { CompositeItem } from '../internals/composite/item/CompositeItem';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toggle](https://base-ui.com/react/components/toggle)
 */
export function Toggle<Value extends string>(componentProps: Toggle.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'defaultPressed',
    'disabled',
    'form', // never participates in form validation
    'onPressedChange',
    'pressed',
    'type', // cannot change button type
    'value',
    'nativeButton',
  );

  // `|| undefined` handles cases where the value is falsy (i.e. "")
  const value = createBaseUiId(() => componentProps.value || undefined);
  const groupContext = useToggleGroupContext<string>();

  const disabled = () => (componentProps.disabled || groupContext?.disabled) ?? false;

  if (isDev && groupContext) {
    createEffect(
      () => componentProps.value === undefined && groupContext.isValueInitialized,
      (shouldWarn) => {
        if (shouldWarn) {
          error(
            'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
            'This will cause issues between the Toggle Group and Toggle values.',
            'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
          );
        }
      },
    );
  }

  const [uncontrolledPressed, setPressedState] = createControllableSignal<boolean>({
    value: () => componentProps.pressed,
    defaultValue: () => componentProps.defaultPressed ?? false,
  });

  const pressed = () => {
    if (groupContext) {
      return groupContext.value.indexOf(value()) > -1;
    }
    return uncontrolledPressed();
  };

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => componentProps.nativeButton ?? true,
  });

  const state: ToggleState = {
    get disabled() {
      return disabled();
    },
    get pressed() {
      return pressed();
    },
  };

  const toggleProps: HTMLProps = {
    get 'aria-pressed'() {
      return pressed();
    },
    onClick(event: MouseEvent) {
      const nextPressed = !pressed();
      const details = createChangeEventDetails(REASONS.none, event);

      // `onPressedChange` runs before the group commits so that canceling here
      // can also veto the group value change, which shares this `details` object.
      componentProps.onPressedChange?.(nextPressed, details);

      if (details.isCanceled) {
        return;
      }

      const currentValue = value();
      if (currentValue) {
        groupContext?.setGroupValue(currentValue, nextPressed, details);
      }

      if (details.isCanceled) {
        return;
      }

      if (!groupContext) {
        setPressedState(nextPressed);
      }
    },
  };

  if (groupContext) {
    // A disabled toggle is natively disabled and cannot hold roving focus.
    // Toolbar reads this metadata to compute its `disabledIndices`.
    const itemMetadata: ToolbarRoot.ItemMetadata = {
      get disabled() {
        return disabled();
      },
      focusableWhenDisabled: false,
    };

    return (
      <CompositeItem
        tag="button"
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        metadata={itemMetadata}
        state={state}
        ref={buttonRef}
        props={[toggleProps, elementProps, getButtonProps]}
      />
    );
  }

  return renderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [toggleProps, elementProps, getButtonProps],
  });
}

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleProps<Value extends string = string>
  extends NativeButtonProps, Omit<BaseUIComponentProps<'button', ToggleState>, 'value'> {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `pressed`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the pressed state is changed.
   */
  onPressedChange?:
    | ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void)
    | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleChangeEventReason = typeof REASONS.none;

export type ToggleChangeEventDetails = BaseUIChangeEventDetails<Toggle.ChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<TValue extends string = string> = ToggleProps<TValue>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}
