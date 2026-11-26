import { createFileRoute } from '@tanstack/solid-router';
import { NotFound } from '../components/NotFound';

// Prerendered to `404.html`, which the host serves for unknown URLs.
export const Route = createFileRoute('/404')({
  head: () => ({ meta: [{ title: 'Page not found — Solid Base' }] }),
  component: NotFound,
});
