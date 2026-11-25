import { Dialog } from '@egoist/solid-base/dialog';
import styles from './uncontained.module.css';

export default function UncontainedDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger class={styles.Button}>Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop class={styles.Backdrop} />
        <Dialog.Viewport class={styles.Viewport}>
          <Dialog.Popup class={styles.PopupRoot}>
            <Dialog.Close class={styles.Close} aria-label="Close">
              <XIcon />
            </Dialog.Close>
            <div class={styles.Popup}>
              <Dialog.Title class={styles.Title}>Photo 03 / 12</Dialog.Title>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="m3 3 10 10M3 13 13 3" />
    </svg>
  );
}
