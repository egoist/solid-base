import type { Component } from 'solid-js';
import { Dynamic, type JSX } from '@solidjs/web';
import { Popover } from '@egoist/solid-base/popover';
import styles from './detached-triggers-full.module.css';

const demoPopover = Popover.createHandle<Component>();

export default function PopoverDetachedTriggersFullDemo() {
  return (
    <div class={styles.Container}>
      <Popover.Trigger class={styles.Button} handle={demoPopover} payload={ShippingPanel}>
        Shipping
      </Popover.Trigger>
      <Popover.Trigger class={styles.Button} handle={demoPopover} payload={ReturnsPanel}>
        Returns
      </Popover.Trigger>
      <Popover.Trigger class={styles.Button} handle={demoPopover} payload={ProfilePanel}>
        Profile
      </Popover.Trigger>

      <Popover.Root handle={demoPopover}>
        {(state) => (
          <Popover.Portal>
            <Popover.Positioner class={styles.Positioner} sideOffset={8}>
              <Popover.Popup class={styles.Popup}>
                <Popover.Arrow class={styles.Arrow} />
                <Popover.Viewport class={styles.Viewport}>
                  <Dynamic component={state.payload} />
                </Popover.Viewport>
                <Popover.Close aria-label="Close" class={styles.Close}>
                  <XIcon />
                </Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </Popover.Root>
    </div>
  );
}

function ShippingPanel() {
  return (
    <div class={styles.Stack}>
      <Popover.Title class={styles.Title}>Free shipping</Popover.Title>
      <Popover.Description class={styles.Description}>
        Orders over $50 arrive in 3–5 business days at no extra cost.
      </Popover.Description>
    </div>
  );
}

function ReturnsPanel() {
  return (
    <div class={styles.Stack}>
      <Popover.Title class={styles.Title}>Free returns</Popover.Title>
      <Popover.Description class={styles.Description}>
        Return any item within 30 days for a full refund.
      </Popover.Description>
    </div>
  );
}

function ProfilePanel() {
  return (
    <div class={styles.Profile}>
      <Popover.Title class={styles.Title}>Jason Eventon</Popover.Title>
      <img
        src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80"
        width="48"
        height="48"
        alt=""
        class={styles.Avatar}
      />
      <span class={styles.Plan}>Pro plan</span>
      <div class={styles.ProfileActions}>
        <a href="#">Profile settings</a>
        <a href="#">Log out</a>
      </div>
    </div>
  );
}

function XIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      {...props}
    >
      <path d="m4.5 4.5 7 7m-7 0 7-7" />
    </svg>
  );
}
