import { createUniqueId } from 'solid-js';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import styles from './radio-group.module.css';


export default function ExampleRadioGroup() {
  const id = createUniqueId();
  return (
    <RadioGroup aria-labelledby={id} defaultValue="fuji-apple" class={styles.RadioGroup}>
      <div class={styles.Caption} id={id}>
        Best apple
      </div>

      <label class={styles.Item}>
        <Radio.Root value="fuji-apple" class={styles.Radio}>
          <Radio.Indicator class={styles.Indicator} />
        </Radio.Root>
        Fuji
      </label>

      <label class={styles.Item}>
        <Radio.Root value="gala-apple" class={styles.Radio}>
          <Radio.Indicator class={styles.Indicator} />
        </Radio.Root>
        Gala
      </label>

      <label class={styles.Item}>
        <Radio.Root value="granny-smith-apple" class={styles.Radio}>
          <Radio.Indicator class={styles.Indicator} />
        </Radio.Root>
        Granny Smith
      </label>
    </RadioGroup>
  );
}
