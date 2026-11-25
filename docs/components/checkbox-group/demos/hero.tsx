import { For, createUniqueId } from 'solid-js';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import styles from './hero.module.css';

const apples = [
  { value: 'fuji-apple', label: 'Fuji' },
  { value: 'gala-apple', label: 'Gala' },
  { value: 'granny-smith-apple', label: 'Granny Smith' },
];

export default function CheckboxGroupDemo() {
  const id = createUniqueId();

  return (
    <CheckboxGroup aria-labelledby={id} defaultValue={['fuji-apple']} class={styles.CheckboxGroup}>
      <div class={styles.Caption} id={id}>
        Apples
      </div>
      <For each={apples}>
        {(apple) => (
          <label class={styles.Item}>
            <Checkbox.Root name="apple" value={apple.value} class={styles.Checkbox}>
              <Checkbox.Indicator class={styles.Indicator}>
                <CheckIcon />
              </Checkbox.Indicator>
            </Checkbox.Root>
            {apple.label}
          </label>
        )}
      </For>
    </CheckboxGroup>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
