import { createSignal } from 'solid-js';
import { Menu } from '@egoist/solid-base/menu';
import styles from './checkbox-items.module.css';

export default function ExampleMenu() {
  const [showMinimap, setShowMinimap] = createSignal(true);
  const [showSearch, setShowSearch] = createSignal(true);
  const [showSidebar, setShowSidebar] = createSignal(false);

  return (
    <Menu.Root>
      <Menu.Trigger class={styles.Button}>
        Workspace <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
          <Menu.Popup class={styles.Popup}>
            <Menu.CheckboxItem
              checked={showMinimap()}
              onCheckedChange={(checked) => setShowMinimap(checked)}
              class={styles.CheckboxItem}
            >
              <Menu.CheckboxItemIndicator class={styles.CheckboxItemIndicator}>
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              <span class={styles.CheckboxItemText}>Minimap</span>
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              checked={showSearch()}
              onCheckedChange={(checked) => setShowSearch(checked)}
              class={styles.CheckboxItem}
            >
              <Menu.CheckboxItemIndicator class={styles.CheckboxItemIndicator}>
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              <span class={styles.CheckboxItemText}>Search</span>
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              checked={showSidebar()}
              onCheckedChange={(checked) => setShowSidebar(checked)}
              class={styles.CheckboxItem}
            >
              <Menu.CheckboxItemIndicator class={styles.CheckboxItemIndicator}>
                <CheckIcon />
              </Menu.CheckboxItemIndicator>
              <span class={styles.CheckboxItemText}>Sidebar</span>
            </Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function CaretDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style={{ display: 'block' }}>
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
