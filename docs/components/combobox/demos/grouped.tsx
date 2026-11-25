import { createUniqueId } from 'solid-js';
import { Combobox } from '@egoist/solid-base/combobox';
import styles from './grouped.module.css';

export default function ExampleGroupedCombobox() {
  const id = createUniqueId();

  return (
    <Combobox.Root items={groupedProduce}>
      <div class={styles.Label}>
        <label for={id}>Select produce</label>
        <Combobox.InputGroup class={styles.InputGroup}>
          <Combobox.Input placeholder="e.g. Mango" id={id} class={styles.Input} />
          <div class={styles.ActionButtons}>
            <Combobox.Clear class={styles.Clear} aria-label="Clear selection">
              <XIcon />
            </Combobox.Clear>
            <Combobox.Trigger class={styles.Trigger} aria-label="Open popup">
              <CaretDownIcon />
            </Combobox.Trigger>
          </div>
        </Combobox.InputGroup>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner class={styles.Positioner} sideOffset={4}>
          <Combobox.Popup class={styles.Popup}>
            <Combobox.Empty class={styles.Empty}>No produce found.</Combobox.Empty>
            <Combobox.List class={styles.List}>
              {(group: ProduceGroup) => (
                <Combobox.Group items={group.items} class={styles.Group}>
                  <Combobox.GroupLabel class={styles.GroupLabel}>{group.value}</Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: Produce) => (
                      <Combobox.Item value={item} class={styles.Item}>
                        <Combobox.ItemIndicator class={styles.ItemIndicator}>
                          <CheckIcon />
                        </Combobox.ItemIndicator>
                        <span class={styles.ItemText}>{item.label}</span>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style={{ display: 'block' }}>
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style={{ display: 'block' }}>
      <path d="m4.5 4.5 7 7m-7 0 7-7" />
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

interface Produce {
  id: string;
  label: string;
  group: 'Fruits' | 'Vegetables';
}

interface ProduceGroup {
  value: string;
  items: Produce[];
}

const produceData: Produce[] = [
  { id: 'fruit-apple', label: 'Apple', group: 'Fruits' },
  { id: 'fruit-banana', label: 'Banana', group: 'Fruits' },
  { id: 'fruit-mango', label: 'Mango', group: 'Fruits' },
  { id: 'fruit-kiwi', label: 'Kiwi', group: 'Fruits' },
  { id: 'fruit-grape', label: 'Grape', group: 'Fruits' },
  { id: 'fruit-orange', label: 'Orange', group: 'Fruits' },
  { id: 'fruit-strawberry', label: 'Strawberry', group: 'Fruits' },
  { id: 'fruit-watermelon', label: 'Watermelon', group: 'Fruits' },
  { id: 'veg-broccoli', label: 'Broccoli', group: 'Vegetables' },
  { id: 'veg-carrot', label: 'Carrot', group: 'Vegetables' },
  { id: 'veg-cauliflower', label: 'Cauliflower', group: 'Vegetables' },
  { id: 'veg-cucumber', label: 'Cucumber', group: 'Vegetables' },
  { id: 'veg-kale', label: 'Kale', group: 'Vegetables' },
  { id: 'veg-pepper', label: 'Bell pepper', group: 'Vegetables' },
  { id: 'veg-spinach', label: 'Spinach', group: 'Vegetables' },
  { id: 'veg-zucchini', label: 'Zucchini', group: 'Vegetables' },
];

function groupProduce(items: Produce[]): ProduceGroup[] {
  const groups: Record<string, Produce[]> = {};
  for (const item of items) {
    (groups[item.group] ??= []).push(item);
  }
  return ['Fruits', 'Vegetables'].map((value) => ({ value, items: groups[value] ?? [] }));
}

const groupedProduce: ProduceGroup[] = groupProduce(produceData);
