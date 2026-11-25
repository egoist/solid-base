import { Avatar } from '@egoist/solid-base/avatar';
import styles from './hero.module.css';

export default function ExampleAvatar() {
  return (
    <div class={styles.Row}>
      <Avatar.Root class={styles.Root}>
        <Avatar.Image
          src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80"
          width="48"
          height="48"
          class={styles.Image}
        />
        <Avatar.Fallback delay={600} class={styles.Fallback}>
          LT
        </Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root class={styles.Root}>LT</Avatar.Root>
    </div>
  );
}
