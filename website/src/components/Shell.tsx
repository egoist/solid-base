import { onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRouter } from '@tanstack/solid-router';
import { Header } from './Header';
import { handleCopyClick } from '../lib/copy';
import { syncTheme } from '../lib/theme';

export function Shell(props: { children?: JSX.Element }) {
  const router = useRouter();

  onSettled(() => {
    syncTheme();
  });

  // Markdown is rendered to HTML, so its internal links are plain anchors: route them client-side.
  function handleClick(event: MouseEvent) {
    handleCopyClick(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href || !href.startsWith('/') || anchor.target || anchor.closest('[data-router-link]')) {
      return;
    }
    if (anchor.closest('.prose-block, .api')) {
      event.preventDefault();
      void router.navigate({ href });
    }
  }

  return (
    <div class="shell" onClick={handleClick}>
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      {props.children}
    </div>
  );
}
