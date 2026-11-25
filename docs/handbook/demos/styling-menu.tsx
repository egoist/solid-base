import { Menu } from '@egoist/solid-base/menu';
import styles from './styling-menu.module.css';

export default function ExampleMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger class={styles.Button}>
        Song <ChevronDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class={styles.Positioner} sideOffset={8}>
          <Menu.Popup class={styles.Popup}>
            <Menu.Item class={styles.Item}>Add to Library</Menu.Item>
            <Menu.Item class={styles.Item}>Add to Playlist</Menu.Item>
            <Menu.Separator class={styles.Separator} />
            <Menu.Item class={styles.Item}>Play Next</Menu.Item>
            <Menu.Item class={styles.Item}>Play Last</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M1 3.5L5 7.5L9 3.5" />
    </svg>
  );
}
