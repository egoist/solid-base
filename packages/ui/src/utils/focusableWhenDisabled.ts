import { merge, type Accessor } from 'solid-js';
import type { HTMLProps } from '../internals/types';

export interface CreateFocusableWhenDisabledParameters {
  /**
   * Whether the component should be focusable when disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: Accessor<boolean | undefined> | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether this is a composite item or not.
   * @default false
   */
  composite?: Accessor<boolean> | undefined;
  /**
   * @default 0
   */
  tabIndex?: Accessor<number | undefined> | undefined;
  /**
   * @default true
   */
  isNativeButton: Accessor<boolean>;
}

/**
 * Props that keep a disabled control focusable (or not), matching native button semantics.
 * Only the relevant keys are present, so later sources can still provide them.
 */
export function createFocusableWhenDisabled(
  params: CreateFocusableWhenDisabledParameters,
): HTMLProps {
  const onKeyDown = (event: KeyboardEvent) => {
    if (params.disabled() && params.focusableWhenDisabled?.() && event.key !== 'Tab') {
      event.preventDefault();
    }
  };

  return merge(() => {
    const focusableWhenDisabled = params.focusableWhenDisabled?.();
    const disabled = params.disabled();
    const composite = params.composite?.() ?? false;
    const tabIndex = params.tabIndex?.() ?? 0;
    const isNativeButton = params.isNativeButton();
    const isFocusableComposite = composite && focusableWhenDisabled !== false;
    const isNonFocusableComposite = composite && focusableWhenDisabled === false;

    const props: HTMLProps = { onKeyDown };

    if (!composite) {
      props.tabindex = tabIndex;
      if (!isNativeButton && disabled) {
        props.tabindex = focusableWhenDisabled ? tabIndex : -1;
      }
    }

    if (
      (isNativeButton && (focusableWhenDisabled || isFocusableComposite)) ||
      (!isNativeButton && disabled)
    ) {
      props['aria-disabled'] = disabled;
    }

    if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) {
      (props as Record<string, unknown>).disabled = disabled;
    }

    return props;
  });
}
