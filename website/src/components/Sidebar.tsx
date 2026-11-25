import { For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Collapsible } from '@egoist/solid-base/collapsible';
import { ScrollArea } from '@egoist/solid-base/scroll-area';
import { pagesIn, sections } from '../lib/docs';
import { DocLink } from './DocLink';
import { BlocksIcon, BookIcon, ChevronIcon, RocketIcon, WrenchIcon } from './icons';

const SECTION_ICONS: Record<string, () => JSX.Element> = {
  overview: () => <RocketIcon />,
  handbook: () => <BookIcon />,
  components: () => <BlocksIcon />,
  utils: () => <WrenchIcon />,
};

/** Navigation groups, each a collapsible section (the library's Collapsible). */
export function SidebarLinks(props: { onNavigate?: () => void }) {
  return (
    <nav class="sidebar-nav" aria-label="Documentation">
      <For each={sections.filter((section) => pagesIn(section.key).length > 0)}>
        {(section) => (
          <Collapsible.Root class="sidebar-group" defaultOpen>
            <Collapsible.Trigger class="sidebar-group-trigger">
              <span class="sidebar-group-icon">{SECTION_ICONS[section.key]?.()}</span>
              <span class="sidebar-group-title">{section.title}</span>
              <ChevronIcon class="sidebar-group-chevron" />
            </Collapsible.Trigger>
            <Collapsible.Panel class="sidebar-group-panel">
              <ul>
                <For each={pagesIn(section.key)}>
                  {(page) => (
                    <li>
                      <DocLink
                        route={page.route}
                        class="sidebar-link"
                        onClick={() => props.onNavigate?.()}
                      >
                        <span>{page.frontmatter.title}</span>
                        <Show when={page.frontmatter.badge}>
                          <span class="sidebar-badge">{page.frontmatter.badge}</span>
                        </Show>
                      </DocLink>
                    </li>
                  )}
                </For>
              </ul>
            </Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </nav>
  );
}

/** Uses the library's ScrollArea for the custom scrollbar. */
export function Sidebar() {
  return (
    <aside class="sidebar">
      <ScrollArea.Root class="sidebar-scroll">
        <ScrollArea.Viewport class="sidebar-viewport">
          <ScrollArea.Content>
            <SidebarLinks />
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar class="scrollbar" orientation="vertical">
          <ScrollArea.Thumb class="scrollbar-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </aside>
  );
}
