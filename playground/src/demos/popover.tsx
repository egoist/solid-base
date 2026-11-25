import { Popover } from '@egoist/solid-base/popover';
import styles from './popover.module.css';


export default function ExamplePopover() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.IconButton} aria-label="Shipping information">
        <InfoIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup class={styles.Popup}>
            <Popover.Arrow class={styles.Arrow} />
            <Popover.Title class={styles.Title}>Free shipping</Popover.Title>
            <Popover.Description class={styles.Description}>
              Orders over $50 arrive in 3–5 business days at no extra cost.
            </Popover.Description>
            {/* Upstream uses `#`; keep the hash-routed playground on this demo. */}
            <a href="#popover" class={styles.Link}>
              View shipping policy
            </a>
            <Popover.Close aria-label="Close" class={styles.Close}>
              <XIcon />
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      style={{ display: 'block' }}
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.5v3.5" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      style={{ display: 'block' }}
    >
      <path d="m4.5 4.5 7 7m-7 0 7-7" />
    </svg>
  );
}
