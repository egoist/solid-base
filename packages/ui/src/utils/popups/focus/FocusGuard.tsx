import { createSignal, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { platform } from '@egoist/solid-base-utils/platform';
import { visuallyHidden } from '@egoist/solid-base-utils/visuallyHidden';

/**
 * A visually hidden, focusable element used to trap or redirect focus.
 * @internal
 */
export function FocusGuard(props: JSX.HTMLAttributes<HTMLSpanElement> & { 'data-type'?: string }) {
  const [role, setRole] = createSignal<'button' | undefined>(undefined);

  onSettled(() => {
    // Unlike NVDA and JAWS, VoiceOver's virtual cursor triggers `onFocus` as it moves — but only
    // on focusable/role-button elements through WebKit's NSAccessibility path. Setting
    // `role="button"` lets the focus trap catch the cursor.
    if (platform.screenReader.voiceOver && platform.engine.webkit) {
      setRole('button');
    }
  });

  return (
    <span
      {...props}
      style={visuallyHidden}
      aria-hidden={role() ? undefined : 'true'}
      tabindex={0}
      role={role()}
      data-base-ui-focus-guard=""
    />
  );
}
