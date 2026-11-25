import { createFileRoute } from '@tanstack/solid-router';
import { Home } from '../components/Home';

export const Route = createFileRoute('/')({
  component: Home,
});
