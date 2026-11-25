import { For, createUniqueId } from 'solid-js';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import styles from './native-button.module.css';

const storageTypes = [
  { value: 'ssd', label: 'SSD', detail: 'Fast, for databases' },
  { value: 'hdd', label: 'HDD', detail: 'Cheap, for archives' },
  { value: 'nvme', label: 'NVMe', detail: 'Fastest, for scratch' },
];

export default function NativeButtonRadio() {
  const id = createUniqueId();

  return (
    <RadioGroup aria-labelledby={id} defaultValue="ssd" class={styles.RadioGroup}>
      <div class={styles.Caption} id={id}>
        Storage type
      </div>
      <For each={storageTypes}>
        {(type) => (
          <div class={styles.Row}>
            <Radio.Root
              value={type.value}
              id={`${id}-${type.value}`}
              nativeButton
              render="button"
              class={styles.Radio}
            >
              <Radio.Indicator class={styles.Indicator} />
            </Radio.Root>
            <label for={`${id}-${type.value}`} class={styles.Label}>
              {type.label}
              <span class={styles.Detail}>{type.detail}</span>
            </label>
          </div>
        )}
      </For>
    </RadioGroup>
  );
}
