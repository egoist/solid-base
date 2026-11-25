import { Collapsible } from '@egoist/solid-base/collapsible';
import styles from './collapsible.module.css';

export const title = 'Collapsible';

export default function ExampleCollapsible() {
  return (
    <Collapsible.Root class={styles.Collapsible}>
      <Collapsible.Trigger class={styles.Trigger}>
        Recovery keys
        <CaretRightIcon class={styles.Icon} />
      </Collapsible.Trigger>
      <Collapsible.Panel class={styles.Panel}>
        <div class={styles.Content}>
          <div>alien-bean-pasta</div>
          <div>wild-irish-burrito</div>
          <div>horse-battery-staple</div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function CaretRightIcon(props: { class?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      class={props.class}
      style={{ display: 'block' }}
    >
      <path d="M6 12V4l4.5 4z" />
    </svg>
  );
}
