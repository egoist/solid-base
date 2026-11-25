import { For } from 'solid-js';
import { Toast } from '@egoist/solid-base/toast';
import styles from './deduplicate.module.css';

export default function DeduplicateToastDemo() {
  return (
    <Toast.Provider>
      <SaveButton />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function SaveButton() {
  const toastManager = Toast.useToastManager();

  function createToast() {
    toastManager.add({
      id: 'save-status',
      title: 'Draft saved',
      description: 'Click again while it is visible to replay the pulse.',
    });
  }

  return (
    <button type="button" class={styles.Button} onClick={createToast}>
      Save draft
    </button>
  );
}

function ToastList() {
  const toastManager = Toast.useToastManager();
  return <For each={toastManager.toasts}>{(toast) => <PulseToast toast={toast} />}</For>;
}

function PulseToast(props: { toast: Toast.Root.ToastObject }) {
  // New toasts start with `updateKey: 0`, so the first add skips the replay pulse.
  const pulseClass = () => {
    const updateKey = props.toast.updateKey;
    if (!updateKey) {
      return undefined;
    }
    return updateKey % 2 === 0 ? styles.PulseEven : styles.PulseOdd;
  };

  return (
    <Toast.Root toast={props.toast} class={[styles.Toast, pulseClass()]}>
      <Toast.Content class={styles.Content}>
        <div class={styles.Text}>
          <Toast.Title class={styles.Title} />
          <Toast.Description class={styles.Description} />
        </div>
        <Toast.Close class={styles.Close}>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  );
}
