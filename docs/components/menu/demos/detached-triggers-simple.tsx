import { Menu } from '@egoist/solid-base/menu';
import styles from './detached-triggers-simple.module.css';

const demoMenu = Menu.createHandle();

export default function MenuDetachedTriggersSimpleDemo() {
  return (
    <>
      <Menu.Trigger class={styles.IconButton} handle={demoMenu} aria-label="Project actions">
        <EllipsisHorizontalIcon />
      </Menu.Trigger>

      <Menu.Root handle={demoMenu}>
        <Menu.Portal>
          <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
            <Menu.Popup class={styles.Popup}>
              <Menu.Item class={styles.Item}>Rename</Menu.Item>
              <Menu.Item class={styles.Item}>Duplicate</Menu.Item>
              <Menu.Item class={styles.Item}>Move to folder</Menu.Item>
              <Menu.Separator class={styles.Separator} />
              <Menu.Item class={styles.Item}>Archive</Menu.Item>
              <Menu.Item class={styles.Item}>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  );
}

function EllipsisHorizontalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
      <circle cx="3" cy="8" r="1" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="13" cy="8" r="1" />
    </svg>
  );
}
