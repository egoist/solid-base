import { createSignal } from 'solid-js';
import { Drawer } from '@egoist/solid-base/drawer';
import styles from './swipe-area.module.css';

export default function SwipeAreaDrawerDemo() {
  const [container, setContainer] = createSignal<HTMLDivElement>();

  return (
    <div class={styles.Root} ref={setContainer}>
      <Drawer.Root swipeDirection="right" modal={false}>
        <Drawer.SwipeArea class={styles.SwipeArea}>
          <span class={styles.SwipeLabel}>Swipe here</span>
        </Drawer.SwipeArea>
        <div class={styles.Center}>
          <p class={styles.Hint}>Swipe from the right edge to open the drawer.</p>
        </div>
        <Drawer.Portal container={container}>
          <Drawer.Backdrop class={styles.Backdrop} />
          <Drawer.Viewport class={styles.Viewport}>
            <Drawer.Popup class={styles.Popup}>
              <Drawer.Content class={styles.Content}>
                <Drawer.Title class={styles.Title}>Library</Drawer.Title>
                <Drawer.Description class={styles.Description}>
                  Swipe from the edge whenever you want to jump back into your playlists.
                </Drawer.Description>
                <div class={styles.Actions}>
                  <Drawer.Close class={styles.Button}>Close</Drawer.Close>
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
