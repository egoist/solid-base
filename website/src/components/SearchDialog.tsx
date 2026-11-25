import { createSignal, onSettled, Show } from 'solid-js';
import { useRouter } from '@tanstack/solid-router';
import { Dialog } from '@egoist/solid-base/dialog';
import { Autocomplete } from '@egoist/solid-base/autocomplete';
import { pages, sections } from '../lib/docs';
import { CornerIcon, SearchIcon } from './icons';

interface SearchItem {
  route: string;
  title: string;
  section: string;
  description: string;
}

const items: SearchItem[] = pages.map((page) => ({
  route: page.route,
  title: page.frontmatter.title,
  section: sections.find((section) => section.key === page.section)?.title ?? '',
  description: page.frontmatter.description ?? '',
}));

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

/** A command palette made of the library's own Dialog and inline Autocomplete. */
export function SearchDialog() {
  const [open, setOpen] = createSignal(false);
  const router = useRouter();

  onSettled(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, [contenteditable="true"]');
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  let highlighted: SearchItem | undefined;

  function go(item: SearchItem) {
    setOpen(false);
    void router.navigate({ href: item.route });
  }

  return (
    <Dialog.Root open={open()} onOpenChange={(next) => setOpen(next)}>
      <Dialog.Trigger class="search-trigger">
        <SearchIcon />
        <span class="search-trigger-label">Search docs</span>
        <span class="kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop class="search-backdrop" />
        <Dialog.Popup class="search-popup" aria-label="Search documentation">
          <Autocomplete.Root
            items={items}
            inline
            open
            autoHighlight="always"
            itemToStringValue={(item: SearchItem) => item.title}
            onItemHighlighted={(item) => {
              highlighted = item as SearchItem | undefined;
            }}
          >
            <div class="search-field">
              <SearchIcon />
              <Autocomplete.Input
                class="search-input"
                placeholder="Search components and guides…"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && highlighted) {
                    event.preventDefault();
                    go(highlighted);
                  }
                }}
              />
              <span class="kbd">esc</span>
            </div>
            <Autocomplete.Empty class="search-empty">No pages match your search.</Autocomplete.Empty>
            <Autocomplete.List class="search-list">
              {(item: SearchItem) => (
                <Autocomplete.Item value={item} class="search-item" onClick={() => go(item)}>
                  <span class="search-item-section">{item.section}</span>
                  <span class="search-item-title">{item.title}</span>
                  <Show when={item.description}>
                    <span class="search-item-description">{item.description}</span>
                  </Show>
                  <CornerIcon class="search-item-enter" />
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
