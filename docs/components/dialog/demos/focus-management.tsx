import { createUniqueId } from 'solid-js';
import { Dialog } from '@egoist/solid-base/dialog';
import styles from './focus-management.module.css';

export default function FocusManagementDemo() {
  let feedbackInput: HTMLInputElement | undefined;
  let finalFocusButton: HTMLButtonElement | undefined;
  const nameId = createUniqueId();
  const feedbackId = createUniqueId();

  return (
    <div class={styles.Container}>
      <Dialog.Root>
        <Dialog.Trigger class={styles.Button}>Open feedback</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop class={styles.Backdrop} />
          <Dialog.Popup
            class={styles.Popup}
            initialFocus={() => feedbackInput ?? true}
            finalFocus={() => finalFocusButton ?? true}
          >
            <Dialog.Title class={styles.Title}>Feedback form</Dialog.Title>
            <Dialog.Description class={styles.Description}>
              Your feedback means a lot to us.
            </Dialog.Description>
            <div class={styles.Fields}>
              <div class={styles.Field}>
                <label for={nameId} class={styles.Label}>
                  Full name
                </label>
                <input id={nameId} placeholder="Enter your name" class={styles.Input} />
              </div>
              <div class={styles.Field}>
                <label for={feedbackId} class={styles.Label}>
                  Feedback
                </label>
                <input
                  id={feedbackId}
                  ref={feedbackInput}
                  required
                  placeholder="Enter your feedback"
                  class={styles.Input}
                />
              </div>
            </div>
            <div class={styles.Actions}>
              <Dialog.Close class={styles.Button}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <button ref={finalFocusButton} type="button" class={styles.Button}>
        Final focus
      </button>
    </div>
  );
}
