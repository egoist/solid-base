import { createUniqueId } from 'solid-js';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import styles from './checkbox-group.module.css';

export const title = 'Checkbox Group';

export default function ExampleCheckboxGroup() {
  const id = createUniqueId();
  return (
    <CheckboxGroup aria-labelledby={id} defaultValue={['fuji-apple']} class={styles.CheckboxGroup}>
      <div class={styles.Caption} id={id}>
        Apples
      </div>

      <label class={styles.Item}>
        <Checkbox.Root name="apple" value="fuji-apple" class={styles.Checkbox}>
          <Checkbox.Indicator class={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Fuji
      </label>

      <label class={styles.Item}>
        <Checkbox.Root name="apple" value="gala-apple" class={styles.Checkbox}>
          <Checkbox.Indicator class={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Gala
      </label>

      <label class={styles.Item}>
        <Checkbox.Root name="apple" value="granny-smith-apple" class={styles.Checkbox}>
          <Checkbox.Indicator class={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Granny Smith
      </label>
    </CheckboxGroup>
  );
}

function CheckIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      class={props.class}
      style={{ display: 'block' }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
