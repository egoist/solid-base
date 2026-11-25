import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { NavigationMenu } from '@egoist/solid-base/navigation-menu';
import { useMediaQuery } from '@egoist/solid-base/unstable-use-media-query';
import styles from './nested-inline.module.css';

export default function NestedInlineNavigationMenuDemo() {
  const isDesktop = useMediaQuery('(min-width: 700px)', { defaultMatches: true });

  return (
    <NavigationMenu.Root class={styles.Root}>
      <NavigationMenu.List class={styles.List}>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger class={styles.Trigger}>
            Product
            <NavigationMenu.Icon class={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content class={[styles.Content, styles.ProductContent]}>
            {/* No nested Portal: the submenu's List and Viewport stay inside this panel. */}
            <NavigationMenu.Root
              class={styles.SubmenuRoot}
              orientation={isDesktop() ? 'vertical' : 'horizontal'}
              defaultValue="developers"
            >
              <div class={styles.SubmenuLayout}>
                <NavigationMenu.List class={styles.SubmenuList}>
                  <For each={audienceMenus}>
                    {(menu) => (
                      <NavigationMenu.Item value={menu.value}>
                        <NavigationMenu.Trigger class={styles.SubmenuTrigger}>
                          <span class={styles.SubmenuLabel}>{menu.label}</span>
                          <span class={styles.SubmenuHint}>{menu.hint}</span>
                        </NavigationMenu.Trigger>
                        <NavigationMenu.Content class={styles.SubmenuContent}>
                          <div>
                            <h4 class={styles.SubmenuTitle}>{menu.title}</h4>
                            <p class={styles.SubmenuDescription}>{menu.description}</p>
                          </div>
                          <ul class={styles.LinkList}>
                            <For each={menu.links}>
                              {(link) => (
                                <li>
                                  <NavigationMenu.Link class={styles.LinkCard} href={link.href}>
                                    <h5 class={styles.LinkTitle}>{link.title}</h5>
                                    <p class={styles.LinkDescription}>{link.description}</p>
                                  </NavigationMenu.Link>
                                </li>
                              )}
                            </For>
                          </ul>
                        </NavigationMenu.Content>
                      </NavigationMenu.Item>
                    )}
                  </For>
                </NavigationMenu.List>

                <NavigationMenu.Viewport class={styles.SubmenuViewport} />
              </div>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Trigger class={styles.Trigger}>
            Learn
            <NavigationMenu.Icon class={styles.Icon}>
              <CaretDownIcon />
            </NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content class={[styles.Content, styles.GuidesContent]}>
            <div class={styles.GuidesPanel}>
              <div>
                <h4 class={styles.SubmenuTitle}>Where teams usually start</h4>
                <p class={styles.SubmenuDescription}>
                  The pages people reach for first when turning a prototype into shared UI.
                </p>
              </div>
              <ul class={styles.LinkList}>
                <For each={guideLinks}>
                  {(link) => (
                    <li>
                      <NavigationMenu.Link class={styles.LinkCard} href={link.href}>
                        <h5 class={styles.LinkTitle}>{link.title}</h5>
                        <p class={styles.LinkDescription}>{link.description}</p>
                      </NavigationMenu.Link>
                    </li>
                  )}
                </For>
              </ul>
            </div>
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

const audienceMenus = [
  {
    value: 'developers',
    label: 'Developers',
    hint: 'Go from idea to UI faster.',
    title: 'Build product UI without giving up control',
    description:
      'Start with accessible parts and shape them to your app instead of working around a preset design system.',
    links: [
      {
        href: '/components/button',
        title: 'Button',
        description: 'Render as any element and stay focusable when disabled.',
      },
      {
        href: '/components/accordion',
        title: 'Accordion',
        description: 'Collapsible sections with full keyboard support built in.',
      },
    ],
  },
  {
    value: 'systems',
    label: 'Design Systems',
    hint: 'Keep patterns aligned across teams.',
    title: 'Turn shared standards into working components',
    description:
      'Connect tokens, states, and accessibility rules once, then give every product team the same solid starting point.',
    links: [
      {
        href: '/components/checkbox',
        title: 'Checkbox',
        description: 'Map tokens and checked states to your own CSS.',
      },
      {
        href: '/components/switch',
        title: 'Switch',
        description: 'Review keyboard support and semantic defaults before anything ships.',
      },
      {
        href: '/components/tooltip',
        title: 'Tooltip',
        description: 'Set one clear pattern for lightweight help, hints, and field guidance.',
      },
      {
        href: '/components/popover',
        title: 'Popover',
        description: 'Handle richer anchored panels like menus, inspectors, and onboarding.',
      },
    ],
  },
  {
    value: 'managers',
    label: 'Engineering Leads',
    hint: 'Roll out shared UI without drag.',
    title: 'Give squads clear defaults and room to move',
    description:
      'Align on quality bars and extension points while still leaving teams space to customize.',
    links: [
      {
        href: '/components/dialog',
        title: 'Dialog',
        description: 'Settings and confirmation flows with focus management done.',
      },
      {
        href: '/components/menu',
        title: 'Menu',
        description: 'Action menus with keyboard navigation and typeahead.',
      },
      {
        href: '/components/avatar',
        title: 'Avatar',
        description: 'Images with a graceful fallback while they load.',
      },
    ],
  },
  {
    value: 'startups',
    label: 'Startups',
    hint: 'Ship polished basics while things change.',
    title: 'Get sturdy UI foundations in place early',
    description:
      'Cover the hard interaction details now so your team can spend more time on the product ideas that set you apart.',
    links: [
      {
        href: '/components/menu',
        title: 'Menu',
        description: 'Add action menus with keyboard support and focus handling already done.',
      },
      {
        href: '/components/dialog',
        title: 'Dialog',
        description: 'Launch settings or upgrade flows without rebuilding focus management.',
      },
    ],
  },
];

const guideLinks = [
  {
    href: '/components/dialog',
    title: 'Dialog',
    description: 'Take a practical pass over focus trapping, semantics, and keyboard support.',
  },
  {
    href: '/components/popover',
    title: 'Popover',
    description: 'Learn when to anchor content to a trigger and how to position it.',
  },
  {
    href: '/components/navigation-menu',
    title: 'Navigation Menu',
    description: 'Compose links and nested menus for your site header.',
  },
];
