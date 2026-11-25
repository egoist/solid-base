import { Slider } from '@egoist/solid-base/slider';
import styles from './hero.module.css';

export default function SliderDemo() {
  return (
    <Slider.Root defaultValue={25}>
      <Slider.Control class={styles.Control}>
        <Slider.Track class={styles.Track}>
          <Slider.Indicator class={styles.Indicator} />
          <Slider.Thumb aria-label="Volume" class={styles.Thumb} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
