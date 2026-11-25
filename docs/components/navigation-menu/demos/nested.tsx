import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { NavigationMenu } from '@egoist/solid-base/navigation-menu';
import styles from './nested.module.css';

export default function NestedNavigationMenuDemo() {
  return (
    <NavigationMenu.Root class={styles.Root}>
      <NavigationMenu.List class={styles.List}>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger class={styles.Trigger}>
            Components
            <NavigationMenu.Icon class={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content class={styles.Content}>
            <ul class={styles.GridLinkList}>
              <For each={componentLinks}>
                {(item) => (
                  <li>
                    <NavigationMenu.Link class={styles.LinkCard} href={item.href}>
                      <h3 class={styles.LinkTitle}>{item.title}</h3>
                      <p class={styles.LinkDescription}>{item.description}</p>
                    </NavigationMenu.Link>
                  </li>
                )}
              </For>
              <li>
                {/* A nested root opens its own popup next to the parent's content. */}
                <NavigationMenu.Root orientation="vertical">
                  <NavigationMenu.List class={styles.NestedList}>
                    <NavigationMenu.Item>
                      <NavigationMenu.Trigger class={[styles.LinkCard, styles.NestedTrigger]}>
                        <span class={styles.LinkTitle}>Overlays</span>
                        <span class={styles.LinkDescription}>Popups layered over the page.</span>
                        <NavigationMenu.Icon class={styles.NestedIcon}>
                          <CaretRightIcon />
                        </NavigationMenu.Icon>
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content class={styles.Content}>
                        <ul class={styles.FlexLinkList}>
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
                  </NavigationMenu.List>

                  <NavigationMenu.Portal>
                    <NavigationMenu.Positioner
                      class={styles.Positioner}
                      sideOffset={8}
                      alignOffset={-8}
                      align="end"
                      side="right"
                    >
                      <NavigationMenu.Popup class={styles.Popup}>
                        <NavigationMenu.Viewport class={styles.Viewport} />
                      </NavigationMenu.Popup>
                    </NavigationMenu.Positioner>
                  </NavigationMenu.Portal>
                </NavigationMenu.Root>
              </li>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          class={styles.Positioner}
          sideOffset={10}
          collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
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

function CaretRightIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M3.5 9L7.5 5L3.5 1" stroke="currentcolor" stroke-width="1.5" />
    </svg>
  );
}

const componentLinks = [
  {
    href: '/components/accordion',
    title: 'Accordion',
    description: 'A set of collapsible panels with headings.',
  },
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
];

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
];
