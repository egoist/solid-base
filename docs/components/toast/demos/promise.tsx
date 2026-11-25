import { For } from 'solid-js';
import { Toast } from '@egoist/solid-base/toast';
import styles from './promise.module.css';

export default function PromiseToastDemo() {
  return (
    <Toast.Provider>
      <PromiseButton />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function PromiseButton() {
  const toastManager = Toast.useToastManager();

  function runPromise() {
    toastManager.promise(
      // Simulate an API request with a promise that settles after 2 seconds
      new Promise<string>((resolve, reject) => {
        const shouldSucceed = Math.random() > 0.3; // 70% success rate
        setTimeout(() => {
          if (shouldSucceed) {
            resolve('operation completed');
          } else {
            reject(new Error('operation failed'));
          }
        }, 2000);
      }),
      {
        loading: 'Loading data…',
        success: (data: string) => `Success: ${data}`,
        error: (err: Error) => `Error: ${err.message}`,
      },
    )
      // The returned promise settles like the original one: handle its rejection.
      .catch(() => {});
  }

  return (
    <button type="button" class={styles.Button} onClick={runPromise}>
      Run promise
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
              <Toast.Title class={styles.Title} />
              <Toast.Description class={styles.Description} />
            </div>
            <Toast.Close class={styles.Close}>Dismiss</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}
