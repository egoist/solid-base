import { createEffect } from 'solid-js';
import { mergeProps } from '@egoist/solid-base/merge-props';
import { Popover } from '@egoist/solid-base/popover';
import styles from './animation.module.css';

const hidden = { opacity: 0, transform: 'scale(0.8)' };
const shown = { opacity: 1, transform: 'scale(1)' };

export default function JavaScriptAnimatedPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.Button}>Web Animations API</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner class={styles.Positioner} sideOffset={8}>
          <Popover.Popup
            class={styles.Popup}
            render={(props, state) => {
              let element!: HTMLDivElement;
              // Runs when the popup mounts and whenever `open` changes.
              createEffect(
                () => state.open,
                (open) => {
                  element.animate(open ? [hidden, shown] : [shown, hidden], {
                    duration: open ? 300 : 200,
                    easing: open ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'ease-in',
                    fill: 'forwards',
                  });
                },
              );
              return <div {...mergeProps(props, { ref: (el: HTMLDivElement) => (element = el) })} />;
            }}
          >
            <Popover.Title class={styles.Title}>Animated in JavaScript</Popover.Title>
            <Popover.Description class={styles.Description}>
              The popup waits for the exit animation before it unmounts.
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
