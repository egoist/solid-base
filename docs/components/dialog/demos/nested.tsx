import { Dialog } from '@egoist/solid-base/dialog';
import styles from './nested.module.css';

export default function NestedDialogDemo() {
  return (
    <Dialog.Root>
      <Dialog.Trigger class={styles.Button}>View notifications</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop class={styles.Backdrop} />
        <Dialog.Popup class={styles.Popup}>
          <Dialog.Title class={styles.Title}>Notifications</Dialog.Title>
          <Dialog.Description class={styles.Description}>
            You are all caught up. Good job!
          </Dialog.Description>
          <div class={styles.Actions}>
            <Dialog.Root>
              <Dialog.Trigger class={styles.Button}>Customize</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup class={styles.Popup}>
                  <Dialog.Title class={styles.Title}>Customize notifications</Dialog.Title>
                  <Dialog.Description class={styles.Description}>
                    Review your settings here.
                  </Dialog.Description>
                  <div class={styles.Actions}>
                    <Dialog.Close class={styles.Button}>Close</Dialog.Close>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <Dialog.Close class={styles.Button}>Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
