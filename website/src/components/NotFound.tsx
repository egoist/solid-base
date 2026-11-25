import { Link } from '@tanstack/solid-router';

export function NotFound() {
  return (
    <main id="main" class="not-found">
      <p class="eyebrow">Error 404</p>
      <h1 class="display">
        This page is <em>unstyled</em>.
      </h1>
      <p>And also missing. Try the search, or start from the top.</p>
      <Link class="button" to="/">
        Back home
      </Link>
    </main>
  );
}
