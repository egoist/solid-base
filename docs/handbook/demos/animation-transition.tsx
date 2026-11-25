import { Popover } from '@egoist/solid-base/popover';
import styles from './animation.module.css';

export default function TransitionPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.Button}>CSS transition</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner class={styles.Positioner} sideOffset={8}>
          <Popover.Popup class={[styles.Popup, styles.Transition]}>
            <Popover.Title class={styles.Title}>Transitions</Popover.Title>
            <Popover.Description class={styles.Description}>
              Close the popup before it finishes opening: it reverses smoothly.
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
