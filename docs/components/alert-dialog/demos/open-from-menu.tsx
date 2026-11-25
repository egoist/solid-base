import { createSignal } from 'solid-js';
import { AlertDialog } from '@egoist/solid-base/alert-dialog';
import { Menu } from '@egoist/solid-base/menu';
import styles from './open-from-menu.module.css';

export default function OpenFromMenuDemo() {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger class={styles.Button}>
          Playlist <CaretDownIcon />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
            <Menu.Popup class={styles.MenuPopup}>
              <Menu.Item class={styles.MenuItem}>Play</Menu.Item>
              <Menu.Item class={styles.MenuItem}>Share</Menu.Item>
              <Menu.Separator class={styles.Separator} />
              {/* Open the alert dialog when the menu item is clicked */}
              <Menu.Item
                data-color="red"
                class={styles.MenuItem}
                onClick={() => setDialogOpen(true)}
              >
                Delete…
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Control the alert dialog state */}
      <AlertDialog.Root open={dialogOpen()} onOpenChange={setDialogOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop class={styles.Backdrop} />
          <AlertDialog.Popup class={styles.Popup}>
            <AlertDialog.Title class={styles.Title}>Delete playlist?</AlertDialog.Title>
            <AlertDialog.Description class={styles.Description}>
              You can't undo this action.
            </AlertDialog.Description>
            <div class={styles.Actions}>
              <AlertDialog.Close class={styles.Button}>Cancel</AlertDialog.Close>
              <AlertDialog.Close data-variant="danger" class={styles.Button}>
                Delete
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

function CaretDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}
