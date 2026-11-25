import { For, createSignal, createUniqueId } from 'solid-js';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import styles from './parent.module.css';

const apples = [
  { value: 'fuji-apple', label: 'Fuji' },
  { value: 'gala-apple', label: 'Gala' },
  { value: 'granny-smith-apple', label: 'Granny Smith' },
];

export default function ParentCheckbox() {
  const id = createUniqueId();
  const [value, setValue] = createSignal<string[]>([]);

  return (
    <CheckboxGroup
      aria-labelledby={id}
      value={value()}
      onValueChange={(next) => setValue(next)}
      allValues={apples.map((apple) => apple.value)}
      class={styles.CheckboxGroup}
    >
      <label class={styles.Item} id={id}>
        <Checkbox.Root parent class={styles.Checkbox}>
          <Checkbox.Indicator
            class={styles.Indicator}
            render={(props, state) => (
              <span {...props}>{state.indeterminate ? <DashIcon /> : <CheckIcon />}</span>
            )}
          />
        </Checkbox.Root>
        Apples
      </label>

      <div class={styles.Children}>
        <For each={apples}>
          {(apple) => (
            <label class={styles.Item}>
              <Checkbox.Root value={apple.value} class={styles.Checkbox}>
                <Checkbox.Indicator class={styles.Indicator}>
                  <CheckIcon />
                </Checkbox.Indicator>
              </Checkbox.Root>
              {apple.label}
            </label>
          )}
        </For>
      </div>
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

function DashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M2 8h12" />
    </svg>
  );
}
