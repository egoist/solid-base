import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Dialog } from '@egoist/solid-base/dialog';
import { Tooltip } from '@egoist/solid-base/tooltip';
import styles from './composition.module.css';

/** Your own component: it spreads every prop it receives (including `ref`) on its DOM node. */
function MyButton(props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }) {
  const buttonProps = omit(props, 'size');
  return (
    <button
      {...buttonProps}
      type={props.type ?? 'button'}
      class={[styles.Button, props.size === 'sm' ? styles.Small : undefined, props.class]}
    />
  );
}

export default function CompositionDemo() {
  return (
    <Dialog.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={(tooltipProps) => (
            <Dialog.Trigger
              {...tooltipProps}
              render={(dialogProps) => <MyButton {...dialogProps} size="md" />}
            />
          )}
        >
          Open dialog
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner class={styles.TooltipPositioner} sideOffset={8}>
            <Tooltip.Popup class={styles.Tooltip}>Tooltip, dialog trigger and MyButton</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Dialog.Portal>
        <Dialog.Backdrop class={styles.Backdrop} />
        <Dialog.Popup class={styles.Dialog}>
          <Dialog.Title class={styles.Title}>One element, three parts</Dialog.Title>
          <Dialog.Description class={styles.Description}>
            The button you pressed is a tooltip trigger, a dialog trigger and your own button
            component at once.
          </Dialog.Description>
          <Dialog.Close render={(props) => <MyButton {...props} size="sm" />}>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
