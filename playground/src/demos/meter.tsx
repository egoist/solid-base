import { Meter } from '@egoist/solid-base/meter';
import styles from './meter.module.css';

export const title = 'Meter';

export default function ExampleMeter() {
  return (
    <Meter.Root class={styles.Meter} value={24}>
      <Meter.Label class={styles.Label}>Storage Used</Meter.Label>
      <Meter.Value class={styles.Value} />
      <Meter.Track class={styles.Track}>
        <Meter.Indicator class={styles.Indicator} />
      </Meter.Track>
    </Meter.Root>
  );
}
