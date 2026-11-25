import { For, Show } from 'solid-js';
import { Menu } from '@egoist/solid-base/menu';
import styles from './detached-triggers-full.module.css';

interface MenuContent {
  heading: string;
  groups: string[][];
}

const MENUS = {
  library: {
    heading: 'Library',
    groups: [
      ['Add to library', 'Add to favorites'],
      ['Create playlist', 'Create station'],
    ],
  },
  playback: {
    heading: 'Playback',
    groups: [
      ['Play now', 'Add to queue'],
      ['Play next', 'Play last', 'Sleep timer'],
    ],
  },
  share: {
    heading: 'Share',
    groups: [
      ['Copy link', 'Copy embed code'],
      ['Share to contacts', 'Share to social'],
    ],
  },
} satisfies Record<string, MenuContent>;

type MenuKey = keyof typeof MENUS;

const demoMenu = Menu.createHandle<MenuKey>();

export default function MenuDetachedTriggersFullDemo() {
  return (
    <div class={styles.Container}>
      <Menu.Trigger class={styles.Button} handle={demoMenu} payload="library">
        Library
      </Menu.Trigger>
      <Menu.Trigger class={styles.Button} handle={demoMenu} payload="playback">
        Playback
      </Menu.Trigger>
      <Menu.Trigger class={styles.Button} handle={demoMenu} payload="share">
        Share
      </Menu.Trigger>

      <Menu.Root handle={demoMenu} modal={false}>
        {(menu) => (
          <Menu.Portal>
            <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
              <Menu.Popup class={styles.Popup}>
                <Menu.Viewport class={styles.Viewport}>
                  <Show when={menu.payload} keyed>
                    {(payload) => (
                      <For each={MENUS[payload].groups}>
                        {(group, groupIndex) => (
                          <>
                            <Menu.Group>
                              <Show when={groupIndex() === 0}>
                                <Menu.GroupLabel class={styles.GroupLabel}>
                                  {MENUS[payload].heading}
                                </Menu.GroupLabel>
                              </Show>
                              <For each={group}>
                                {(item) => <Menu.Item class={styles.Item}>{item}</Menu.Item>}
                              </For>
                            </Menu.Group>
                            <Show when={groupIndex() < MENUS[payload].groups.length - 1}>
                              <Menu.Separator class={styles.Separator} />
                            </Show>
                          </>
                        )}
                      </For>
                    )}
                  </Show>
                </Menu.Viewport>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </Menu.Root>
    </div>
  );
}
