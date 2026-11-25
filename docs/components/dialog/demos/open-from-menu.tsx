import { createSignal } from 'solid-js';
import { Dialog } from '@egoist/solid-base/dialog';
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
              {/* Open the dialog when the menu item is clicked */}
              <Menu.Item class={styles.MenuItem} onClick={() => setDialogOpen(true)}>
                Details…
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Control the dialog state */}
      <Dialog.Root open={dialogOpen()} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop class={styles.Backdrop} />
          <Dialog.Popup class={styles.Popup}>
            <Dialog.Title class={styles.Title}>Playlist details</Dialog.Title>
            <Dialog.Description class={styles.Description}>
              This playlist contains 24 songs and was last updated today.
            </Dialog.Description>
            <div class={styles.Actions}>
              <Dialog.Close class={styles.Button}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
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
