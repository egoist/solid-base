import { createSignal } from 'solid-js';
import { Button } from '@egoist/solid-base/button';
import styles from './button.module.css';

export const title = 'Button';

export default function ExampleButton() {
  const [count, setCount] = createSignal(0);
  return (
    <div style={{ display: 'flex', gap: '0.75rem', 'flex-wrap': 'wrap' }}>
      <Button class={styles.Button}>Submit</Button>
      <Button class={styles.Button} onClick={() => setCount((c) => c + 1)}>
        Clicked {count()} times
      </Button>
      <Button class={styles.Button} disabled>
        Disabled
      </Button>
      <Button class={styles.Button} disabled focusableWhenDisabled>
        Focusable when disabled
      </Button>
      <Button class={styles.Button} nativeButton={false} render="span">
        Rendered as span
      </Button>
    </div>
  );
}
