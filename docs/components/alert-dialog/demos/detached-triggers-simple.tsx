import { AlertDialog } from '@egoist/solid-base/alert-dialog';
import styles from './detached-triggers-simple.module.css';

const demoAlertDialog = AlertDialog.createHandle();

export default function DetachedTriggersSimpleDemo() {
  return (
    <>
      <AlertDialog.Trigger data-color="red" class={styles.Button} handle={demoAlertDialog}>
        Discard draft
      </AlertDialog.Trigger>

      <AlertDialog.Root handle={demoAlertDialog}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop class={styles.Backdrop} />
          <AlertDialog.Popup class={styles.Popup}>
            <AlertDialog.Title class={styles.Title}>Discard draft?</AlertDialog.Title>
            <AlertDialog.Description class={styles.Description}>
              This action cannot be undone.
            </AlertDialog.Description>
            <div class={styles.Actions}>
              <AlertDialog.Close class={styles.Button}>Cancel</AlertDialog.Close>
              <AlertDialog.Close data-variant="danger" class={styles.Button}>
                Discard
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
