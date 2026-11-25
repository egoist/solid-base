import { For, createUniqueId } from 'solid-js';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import styles from './hero.module.css';

const apples = [
  { value: 'fuji-apple', label: 'Fuji' },
  { value: 'gala-apple', label: 'Gala' },
  { value: 'granny-smith-apple', label: 'Granny Smith' },
];

export default function RadioGroupDemo() {
  const id = createUniqueId();

  return (
    <RadioGroup aria-labelledby={id} defaultValue="fuji-apple" class={styles.RadioGroup}>
      <div class={styles.Caption} id={id}>
        Best apple
      </div>
      <For each={apples}>
        {(apple) => (
          <label class={styles.Item}>
            <Radio.Root value={apple.value} class={styles.Radio}>
              <Radio.Indicator class={styles.Indicator} />
            </Radio.Root>
            {apple.label}
          </label>
        )}
      </For>
    </RadioGroup>
  );
}
