import { For } from 'solid-js';
import { Field } from '@egoist/solid-base/field';
import { Fieldset } from '@egoist/solid-base/fieldset';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import styles from './radio-group.module.css';

const storageTypes = [
  { value: 'ssd', label: 'SSD' },
  { value: 'hdd', label: 'HDD' },
];

export default function FieldsetRadioGroup() {
  return (
    <Field.Root name="storageType">
      <Fieldset.Root
        render={(props) => <RadioGroup {...props} defaultValue="ssd" />}
        class={styles.Fieldset}
      >
        <Fieldset.Legend class={styles.Legend}>Storage type</Fieldset.Legend>
        <For each={storageTypes}>
          {(type) => (
            <Field.Item>
              <Field.Label class={styles.Item}>
                <Radio.Root value={type.value} class={styles.Radio}>
                  <Radio.Indicator class={styles.Indicator} />
                </Radio.Root>
                {type.label}
              </Field.Label>
            </Field.Item>
          )}
        </For>
      </Fieldset.Root>
    </Field.Root>
  );
}
