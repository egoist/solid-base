import { createEffect, untrack, type Accessor } from 'solid-js';
import { useFieldRootContext } from './FieldRootContext';

/**
 * Returns a function setting the field's focused state, recording which control the focused
 * state belongs to.
 *
 * Disabling or unmounting a focused control moves focus away without firing `blur`, so the focused
 * state would otherwise stay latched. A field can have several focus targets, so a control only
 * clears the shared state when focus last landed on itself.
 *
 * @param disabled Whether the control is disabled.
 * @param focusTarget Returns the element receiving focus. Read (untracked) on mount and when
 * `disabled` changes, so it can read a plain variable assigned by a ref callback.
 * @param onFocusedChange Called whenever this control publishes a focused state.
 */
export function createSetFieldFocused(
  disabled: Accessor<boolean | undefined>,
  focusTarget: Accessor<Element | null | undefined>,
  onFocusedChange?: ((focused: boolean) => void) | undefined,
): (focused: boolean) => void {
  const { setFocused, focusOwnerRef } = useFieldRootContext();

  const setFieldFocused = (focused: boolean) => {
    // A disabled target can still be focused (`aria-disabled` elements stay programmatically
    // focusable), but must not publish the field's focused styling.
    // Imperative: called from event handlers and effects, reads `disabled` at call time.
    if (focused ? !untrack(disabled) : focusOwnerRef.current === setFieldFocused) {
      focusOwnerRef.current = focused && setFieldFocused;
      onFocusedChange?.(focused);
      setFocused(focused);
    }
  };

  // Re-run when `disabled` changes so a focused control releases the field even when the browser
  // does not fire `blur`. The setup reclaims focus that no focus event reported (a control focused
  // before mount, or an `aria-disabled` control re-enabled while it kept focus).
  createEffect(
    () => Boolean(disabled()),
    () => {
      const element = untrack(focusTarget);
      const root = element?.getRootNode() as Document | ShadowRoot | undefined;
      if (element && root?.activeElement === element) {
        setFieldFocused(true);
      }
      return () => setFieldFocused(false);
    },
  );

  return setFieldFocused;
}
