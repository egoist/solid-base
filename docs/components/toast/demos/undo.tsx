import { For } from 'solid-js';
import { Toast } from '@egoist/solid-base/toast';
import styles from './undo.module.css';

export default function UndoToastDemo() {
  return (
    <Toast.Provider>
      <ActionButton />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ActionButton() {
  const toastManager = Toast.useToastManager();

  function action() {
    const id = toastManager.add({
      title: 'Action performed',
      description: 'You can undo this action.',
      type: 'success',
      timeout: 10000,
      actionProps: {
        children: 'Undo',
        onClick() {
          toastManager.close(id);
          toastManager.add({
            title: 'Action undone',
          });
        },
      },
    });
  }

  return (
    <button type="button" class={styles.Button} onClick={action}>
      Perform action
    </button>
  );
}

function ToastList() {
  const toastManager = Toast.useToastManager();
  return (
    <For each={toastManager.toasts}>
      {(toast) => (
        <Toast.Root toast={toast} class={styles.Toast}>
          <Toast.Content class={styles.Content}>
            <div class={styles.Text}>
              <div class={styles.Message}>
                <Toast.Title class={styles.Title} />
                <Toast.Description class={styles.Description} />
              </div>
              <Toast.Action class={styles.UndoButton} />
            </div>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}
