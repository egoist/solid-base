/**
 * Copies the code of `.code-copy[data-copy]` buttons (rendered into Markdown HTML) and flashes a
 * confirmation. One delegated listener serves every page.
 */
export function handleCopyClick(event: MouseEvent) {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-copy]');
  if (!button) {
    return;
  }
  void navigator.clipboard?.writeText(button.dataset.copy ?? '').then(() => {
    button.setAttribute('data-copied', '');
    button.setAttribute('aria-label', 'Copied');
    setTimeout(() => {
      button.removeAttribute('data-copied');
      button.setAttribute('aria-label', 'Copy code');
    }, 1600);
  });
}
