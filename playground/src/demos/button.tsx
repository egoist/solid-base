import { createSignal } from 'solid-js';
import { Button } from '@egoist/solid-base/button';

export const title = 'Button';

export default function ButtonDemo() {
  const [count, setCount] = createSignal(0);
  return (
    <div class="row">
      <Button class="btn primary" onClick={() => setCount((c) => c + 1)}>
        Clicked {count()} times
      </Button>
      <Button class="btn" disabled>
        Disabled
      </Button>
      <Button class="btn" disabled focusableWhenDisabled>
        Focusable when disabled
      </Button>
      <Button class="btn" nativeButton={false} render="span">
        Rendered as span
      </Button>
    </div>
  );
}
