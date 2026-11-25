import { Popover } from '@egoist/solid-base/popover';
import styles from './popover.module.css';

export default function QuickStartPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.Button}>
        <BellIcon />
        Notifications
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner class={styles.Positioner} sideOffset={8}>
          <Popover.Popup class={styles.Popup}>
            <Popover.Title class={styles.Title}>Notifications</Popover.Title>
            <Popover.Description class={styles.Description}>
              You are all caught up. Good job!
            </Popover.Description>
            <Popover.Close class={styles.Close}>Dismiss</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6.5a4 4 0 0 1 8 0V10l1.5 2h-11L4 10z" />
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}
