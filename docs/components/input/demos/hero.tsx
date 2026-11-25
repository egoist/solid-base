import { Input } from '@egoist/solid-base/input';
import styles from './hero.module.css';

export default function InputDemo() {
  return (
    <label class={styles.Label}>
      Name
      <Input placeholder="e.g. Colm Tuite" class={styles.Input} />
    </label>
  );
}
