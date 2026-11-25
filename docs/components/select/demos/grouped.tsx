import { For, Show } from 'solid-js';
import { Select } from '@egoist/solid-base/select';
import styles from './grouped.module.css';

const groupedProduce = [
  {
    value: 'Fruits',
    items: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'mango', label: 'Mango' },
      { value: 'kiwi', label: 'Kiwi' },
      { value: 'grape', label: 'Grape' },
      { value: 'orange', label: 'Orange' },
      { value: 'strawberry', label: 'Strawberry' },
      { value: 'watermelon', label: 'Watermelon' },
    ],
  },
  {
    value: 'Vegetables',
    items: [
      { value: 'broccoli', label: 'Broccoli' },
      { value: 'carrot', label: 'Carrot' },
      { value: 'cauliflower', label: 'Cauliflower' },
      { value: 'cucumber', label: 'Cucumber' },
      { value: 'kale', label: 'Kale' },
      { value: 'pepper', label: 'Bell pepper' },
      { value: 'spinach', label: 'Spinach' },
      { value: 'zucchini', label: 'Zucchini' },
    ],
  },
];

export default function ExampleSelectGrouped() {
  return (
    <div class={styles.Field}>
      <Select.Root items={groupedProduce}>
        <Select.Label class={styles.Label}>Produce</Select.Label>
        <Select.Trigger class={styles.Select}>
          <Select.Value class={styles.Value} placeholder="Select produce" />
          <Select.Icon class={styles.Icon}>
            <CaretUpDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner class={styles.Positioner} sideOffset={4}>
            <Select.Popup class={styles.Popup}>
              <Select.ScrollUpArrow class={styles.ScrollArrow}>
                <CaretUpIcon />
              </Select.ScrollUpArrow>
              <Select.List class={styles.List}>
                <For each={groupedProduce}>
                  {(group, index) => (
                    <>
                      <Select.Group class={styles.Group}>
                        <Select.GroupLabel class={styles.GroupLabel}>{group.value}</Select.GroupLabel>
                        <For each={group.items}>
                          {(item) => (
                            <Select.Item value={item.value} class={styles.Item}>
                              <Select.ItemIndicator class={styles.ItemIndicator}>
                                <CheckIcon />
                              </Select.ItemIndicator>
                              <Select.ItemText class={styles.ItemText}>{item.label}</Select.ItemText>
                            </Select.Item>
                          )}
                        </For>
                      </Select.Group>
                      <Show when={index() < groupedProduce.length - 1}>
                        <Select.Separator class={styles.Separator} />
                      </Show>
                    </>
                  )}
                </For>
              </Select.List>
              <Select.ScrollDownArrow class={styles.ScrollArrow}>
                <CaretDownIcon />
              </Select.ScrollDownArrow>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function CaretUpDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      style={{ display: 'block' }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function CaretUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
      <path d="M12 10H4l4-4.5z" />
    </svg>
  );
}

function CaretDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}
