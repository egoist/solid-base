import { Popover } from '@egoist/solid-base/popover';
import styles from './animation.module.css';

export default function KeyframesPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.Button}>CSS animation</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner class={styles.Positioner} sideOffset={8}>
          <Popover.Popup class={[styles.Popup, styles.Keyframes]}>
            <Popover.Title class={styles.Title}>Keyframes</Popover.Title>
            <Popover.Description class={styles.Description}>
              Plays scaleIn when it opens and scaleOut before it unmounts.
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
