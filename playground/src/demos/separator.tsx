import { Separator } from '@egoist/solid-base/separator';
import styles from './separator.module.css';


// Links point at this demo's own hash (upstream uses `#`) so clicking them doesn't navigate the
// hash-routed playground away from the demo.
export default function ExampleSeparator() {
  return (
    <div class={styles.Container}>
      <a href="#separator" class={styles.Link}>
        Home
      </a>
      <a href="#separator" class={styles.Link}>
        Pricing
      </a>
      <a href="#separator" class={styles.Link}>
        Blog
      </a>
      <a href="#separator" class={styles.Link}>
        Support
      </a>

      <Separator orientation="vertical" class={styles.Separator} />

      <a href="#separator" class={styles.Link}>
        Log in
      </a>
      <a href="#separator" class={styles.Link}>
        Sign up
      </a>
    </div>
  );
}
