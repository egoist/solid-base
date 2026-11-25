import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { NavigationMenu } from '@egoist/solid-base/navigation-menu';
import styles from './hero.module.css';

export default function NavigationMenuDemo() {
  return (
    <NavigationMenu.Root class={styles.Root}>
      <NavigationMenu.List class={styles.List}>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger class={styles.Trigger}>
            Overlays
            <NavigationMenu.Icon class={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content class={styles.Content}>
            <ul class={styles.GridLinkList}>
              <For each={overlayLinks}>
                {(item) => (
                  <li>
                    <NavigationMenu.Link class={styles.LinkCard} href={item.href}>
                      <h3 class={styles.LinkTitle}>{item.title}</h3>
                      <p class={styles.LinkDescription}>{item.description}</p>
                    </NavigationMenu.Link>
                  </li>
                )}
              </For>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Trigger class={styles.Trigger}>
            Inputs
            <NavigationMenu.Icon class={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content class={styles.Content}>
            <ul class={styles.FlexLinkList}>
              <For each={inputLinks}>
                {(item) => (
                  <li>
                    <NavigationMenu.Link class={styles.LinkCard} href={item.href}>
                      <h3 class={styles.LinkTitle}>{item.title}</h3>
                      <p class={styles.LinkDescription}>{item.description}</p>
                    </NavigationMenu.Link>
                  </li>
                )}
              </For>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link class={styles.Trigger} href="https://github.com/egoist/solid-base">
            GitHub
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          class={styles.Positioner}
          sideOffset={10}
          collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
          collisionAvoidance={{ side: 'none' }}
        >
          <NavigationMenu.Popup class={styles.Popup}>
            <NavigationMenu.Arrow class={styles.Arrow} />
            <NavigationMenu.Viewport class={styles.Viewport} />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function CaretDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentcolor" stroke-width="1.5" />
    </svg>
  );
}

const overlayLinks = [
  {
    href: '/components/dialog',
    title: 'Dialog',
    description: 'A popup that opens on top of the entire page.',
  },
  {
    href: '/components/popover',
    title: 'Popover',
    description: 'An accessible popup anchored to a button.',
  },
  {
    href: '/components/tooltip',
    title: 'Tooltip',
    description: 'A popup that appears when an element is hovered or focused.',
  },
  {
    href: '/components/menu',
    title: 'Menu',
    description: 'A list of actions in a dropdown, enhanced with keyboard navigation.',
  },
];

const inputLinks = [
  {
    href: '/components/checkbox',
    title: 'Checkbox',
    description: 'An easily stylable checkbox component.',
  },
  {
    href: '/components/switch',
    title: 'Switch',
    description: 'A control that indicates whether a setting is on or off.',
  },
  {
    href: '/components/button',
    title: 'Button',
    description: 'A button component that can be rendered as another tag or focusable when disabled.',
  },
];
