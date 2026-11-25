import { Select } from '@egoist/solid-base/select';
import { Toggle } from '@egoist/solid-base/toggle';
import { ToggleGroup } from '@egoist/solid-base/toggle-group';
import { Toolbar } from '@egoist/solid-base/toolbar';
import styles from './hero.module.css';

export default function ExampleToolbar() {
  return (
    <Toolbar.Root class={styles.Toolbar}>
      <ToggleGroup class={styles.Group} aria-label="Alignment">
        <Toolbar.Button
          render={(props) => <Toggle {...props} />}
          aria-label="Align left"
          value="align-left"
          class={styles.Button}
        >
          Align Left
        </Toolbar.Button>
        <Toolbar.Button
          render={(props) => <Toggle {...props} />}
          aria-label="Align right"
          value="align-right"
          class={styles.Button}
        >
          Align Right
        </Toolbar.Button>
      </ToggleGroup>
      <Toolbar.Separator class={styles.Separator} />
      <Toolbar.Group class={styles.Group} aria-label="Numerical format">
        <Toolbar.Button class={styles.Button} aria-label="Format as currency">
          $
        </Toolbar.Button>
        <Toolbar.Button class={styles.Button} aria-label="Format as percent">
          %
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator class={styles.Separator} />
      <Select.Root defaultValue="Helvetica">
        <Toolbar.Button render={(props) => <Select.Trigger {...props} />} class={styles.Button}>
          <Select.Value />
          <Select.Icon>
            <CaretUpDownIcon />
          </Select.Icon>
        </Toolbar.Button>
        <Select.Portal>
          <Select.Positioner class={styles.Positioner} sideOffset={4} alignItemWithTrigger={false}>
            <Select.Popup class={styles.Popup}>
              <Select.Item class={styles.Item} value="Helvetica">
                <Select.ItemIndicator class={styles.ItemIndicator}>
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText class={styles.ItemText}>Helvetica</Select.ItemText>
              </Select.Item>
              <Select.Item class={styles.Item} value="Arial">
                <Select.ItemIndicator class={styles.ItemIndicator}>
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText class={styles.ItemText}>Arial</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Toolbar.Separator class={styles.Separator} />
      <Toolbar.Link class={styles.Link} href="#">
        Edited 51m ago
      </Toolbar.Link>
    </Toolbar.Root>
  );
}

function CaretUpDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
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
      aria-hidden="true"
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
