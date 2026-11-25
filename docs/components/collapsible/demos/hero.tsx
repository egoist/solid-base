import { Collapsible } from '@egoist/solid-base/collapsible';
import styles from './hero.module.css';

export default function ExampleCollapsible() {
  return (
    <Collapsible.Root class={styles.Collapsible}>
      <Collapsible.Trigger class={styles.Trigger}>
        <CaretRightIcon class={styles.Icon} />
        Recovery keys
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
      class={props.class}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 12V4l4.5 4z" />
    </svg>
  );
}
