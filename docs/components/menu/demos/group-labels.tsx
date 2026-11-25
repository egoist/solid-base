import { createSignal, For } from 'solid-js';
import { Menu } from '@egoist/solid-base/menu';
import styles from './group-labels.module.css';

const sortOptions = [
  { value: 'date', label: 'Date' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
];

export default function ExampleMenu() {
  const [value, setValue] = createSignal('date');
  const [showMinimap, setShowMinimap] = createSignal(true);
  const [showSearch, setShowSearch] = createSignal(true);
  const [showSidebar, setShowSidebar] = createSignal(false);

  const workspace = [
    { label: 'Minimap', checked: showMinimap, setChecked: setShowMinimap },
    { label: 'Search', checked: showSearch, setChecked: setShowSearch },
    { label: 'Sidebar', checked: showSidebar, setChecked: setShowSidebar },
  ];

  return (
    <Menu.Root>
      <Menu.Trigger class={styles.Button}>
        View <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
          <Menu.Popup class={styles.Popup}>
            <Menu.RadioGroup value={value()} onValueChange={(next: string) => setValue(next)}>
              <Menu.GroupLabel class={styles.GroupLabel}>Sort</Menu.GroupLabel>
              <For each={sortOptions}>
                {(option) => (
                  <Menu.RadioItem class={styles.RadioItem} value={option.value}>
                    <Menu.RadioItemIndicator class={styles.RadioItemIndicator}>
                      <CheckIcon />
                    </Menu.RadioItemIndicator>
                    <span class={styles.RadioItemText}>{option.label}</span>
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioGroup>

            <Menu.Separator class={styles.Separator} />

            <Menu.Group>
              <Menu.GroupLabel class={styles.GroupLabel}>Workspace</Menu.GroupLabel>
              <For each={workspace}>
                {(option) => (
                  <Menu.CheckboxItem
                    checked={option.checked()}
                    onCheckedChange={(checked) => option.setChecked(checked)}
                    class={styles.CheckboxItem}
                  >
                    <Menu.CheckboxItemIndicator class={styles.CheckboxItemIndicator}>
                      <CheckIcon />
                    </Menu.CheckboxItemIndicator>
                    <span class={styles.CheckboxItemText}>{option.label}</span>
                  </Menu.CheckboxItem>
                )}
              </For>
            </Menu.Group>
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
