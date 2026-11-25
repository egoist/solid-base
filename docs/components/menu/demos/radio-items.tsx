import { createSignal } from 'solid-js';
import { Menu } from '@egoist/solid-base/menu';
import styles from './radio-items.module.css';

export default function ExampleMenu() {
  const [value, setValue] = createSignal('date');

  return (
    <Menu.Root>
      <Menu.Trigger class={styles.Button}>
        Sort <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
          <Menu.Popup class={styles.Popup}>
            <Menu.RadioGroup value={value()} onValueChange={(next: string) => setValue(next)}>
              <Menu.RadioItem class={styles.RadioItem} value="date">
                <Menu.RadioItemIndicator class={styles.RadioItemIndicator}>
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                <span class={styles.RadioItemText}>Date</span>
              </Menu.RadioItem>
              <Menu.RadioItem class={styles.RadioItem} value="name">
                <Menu.RadioItemIndicator class={styles.RadioItemIndicator}>
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                <span class={styles.RadioItemText}>Name</span>
              </Menu.RadioItem>
              <Menu.RadioItem class={styles.RadioItem} value="type">
                <Menu.RadioItemIndicator class={styles.RadioItemIndicator}>
                  <CheckIcon />
                </Menu.RadioItemIndicator>
                <span class={styles.RadioItemText}>Type</span>
              </Menu.RadioItem>
            </Menu.RadioGroup>
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
