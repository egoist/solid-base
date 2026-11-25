import { Meter } from '@egoist/solid-base/meter';
import styles from './hero.module.css';

export default function ExampleMeter() {
  return (
    <Meter.Root class={styles.Meter} value={24}>
      <Meter.Label class={styles.Label}>Storage used</Meter.Label>
      <Meter.Value class={styles.Value} />
      <Meter.Track class={styles.Track}>
        <Meter.Indicator class={styles.Indicator} />
      </Meter.Track>
    </Meter.Root>
  );
}
