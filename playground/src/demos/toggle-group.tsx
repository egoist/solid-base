import { Toggle } from '@egoist/solid-base/toggle';
import { ToggleGroup } from '@egoist/solid-base/toggle-group';
import styles from './toggle-group.module.css';

export const title = 'Toggle Group';

export default function ExampleToggleGroup() {
  return (
    <ToggleGroup aria-label="Text alignment" defaultValue={['left']} class={styles.Panel}>
      <Toggle aria-label="Align left" value="left" class={styles.Button}>
        <AlignLeftIcon />
      </Toggle>
      <Toggle aria-label="Align center" value="center" class={styles.Button}>
        <AlignCenterIcon />
      </Toggle>
      <Toggle aria-label="Align right" value="right" class={styles.Button}>
        <AlignRightIcon />
      </Toggle>
    </ToggleGroup>
  );
}

function AlignLeftIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      class={props.class}
      style={{ display: 'block' }}
    >
      <path stroke-linecap="square" stroke-linejoin="round" d="M2.5 4.5h11m-11 7h9M2.5 8h5" />
    </svg>
  );
}

function AlignCenterIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      stroke="currentColor"
      class={props.class}
      style={{ display: 'block' }}
    >
      <path stroke-linecap="square" stroke-linejoin="round" d="M2.5 4.5h11m-10 7h9M5.5 8h5" />
    </svg>
  );
}

function AlignRightIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      stroke="currentColor"
      class={props.class}
      style={{ display: 'block' }}
    >
      <path stroke-linecap="square" stroke-linejoin="round" d="M2.5 4.5h11m-9 7h9M8.5 8h5" />
    </svg>
  );
}
