import { createSignal } from 'solid-js';
import { Popover } from '@egoist/solid-base/popover';
import { Switch } from '@egoist/solid-base/switch';
import styles from './customization.module.css';

export default function CancelOutsidePress() {
  const [locked, setLocked] = createSignal(true);
  const [lastReason, setLastReason] = createSignal('—');

  return (
    <div class={styles.Container}>
      <Popover.Root
        onOpenChange={(open, eventDetails) => {
          const reason = eventDetails.reason;
          const canceled = locked() && (reason === 'outside-press' || reason === 'focus-out');
          if (canceled) {
            // Stop the popover from closing: its internal state stays open.
            eventDetails.cancel();
          }
          const action = open ? 'open' : 'close';
          setLastReason(`${action} · ${reason}${canceled ? ' (canceled)' : ''}`);
        }}
      >
        <Popover.Trigger class={styles.Button}>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner class={styles.Positioner} side="bottom" align="end" sideOffset={8}>
            <Popover.Popup class={styles.Popup}>
              <Popover.Title class={styles.Title}>Click outside</Popover.Title>
              <Popover.Description class={styles.Description}>
                While locked, closing from outside is canceled. Press Esc or the trigger to close.
              </Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <div class={styles.Controls}>
        <label class={styles.Label}>
          <Switch.Root
            checked={locked()}
            onCheckedChange={(checked) => setLocked(checked)}
            class={styles.Switch}
          >
            <Switch.Thumb class={styles.Thumb} />
          </Switch.Root>
          Cancel outside interactions
        </label>

        <output class={styles.Output}>
          <span class={styles.OutputLabel}>last change</span> {lastReason()}
        </output>
      </div>
    </div>
  );
}
