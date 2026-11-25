import { Input } from '@egoist/solid-base/input';
import styles from './input.module.css';

export const title = 'Input';

export default function ExampleInput() {
  return (
    <label class={styles.Label}>
      Name
      <Input placeholder="e.g. Colm Tuite" class={styles.Input} />
    </label>
  );
}
