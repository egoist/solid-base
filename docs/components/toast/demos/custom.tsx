import { For, Show } from 'solid-js';
import { Toast } from '@egoist/solid-base/toast';
import styles from './custom.module.css';

interface CustomToastData {
  userId: string;
}

function isCustomToast(
  toast: Toast.Root.ToastObject,
): toast is Toast.Root.ToastObject<CustomToastData> {
  return toast.data?.userId !== undefined;
}

export default function CustomToastDemo() {
  return (
    <Toast.Provider>
      <CustomToastButton />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function CustomToastButton() {
  const toastManager = Toast.useToastManager();

  function action() {
    const data: CustomToastData = {
      userId: '123',
    };

    toastManager.add({
      title: 'Toast with custom data',
      data,
    });
  }

  return (
    <button type="button" class={styles.Button} onClick={action}>
      Create custom toast
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
              <Toast.Title class={styles.Title}>{toast.title}</Toast.Title>
              <Show
                when={isCustomToast(toast) && toast.data}
                fallback={<Toast.Description class={styles.Description} />}
              >
                {(data) => (
                  <Toast.Description class={styles.Description}>
                    data.userId is {data().userId}
                  </Toast.Description>
                )}
              </Show>
            </div>
            <Toast.Close class={styles.Close}>Dismiss</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}
