import { Switch } from '@egoist/solid-base/switch';
import styles from './hero.module.css';

export default function SwitchDemo() {
  return (
    <label class={styles.Label}>
      <Switch.Root defaultChecked class={styles.Switch}>
        <Switch.Thumb class={styles.Thumb} />
      </Switch.Root>
      Notifications
    </label>
  );
}
