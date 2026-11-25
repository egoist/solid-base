import { Separator } from '@egoist/solid-base/separator';
import styles from './hero.module.css';

export default function ExampleSeparator() {
  return (
    <nav class={styles.Container}>
      <a href="#" class={styles.Link}>
        Home
      </a>
      <a href="#" class={styles.Link}>
        Pricing
      </a>
      <a href="#" class={styles.Link}>
        Blog
      </a>
      <a href="#" class={styles.Link}>
        Support
      </a>

      <Separator orientation="vertical" class={styles.Separator} />

      <a href="#" class={styles.Link}>
        Log in
      </a>
      <a href="#" class={styles.Link}>
        Sign up
      </a>
    </nav>
  );
}
