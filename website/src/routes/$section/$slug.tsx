import { createFileRoute, notFound } from '@tanstack/solid-router';
import { DocPage } from '../../components/DocPage';
import { findPage, loadDocModule } from '../../lib/docs';

export const Route = createFileRoute('/$section/$slug')({
  loader: async ({ params }) => {
    const page = findPage(`/${params.section}/${params.slug}`);
    if (!page) {
      throw notFound();
    }
    await loadDocModule(page.route);
    return { route: page.route };
  },
  head: ({ params }) => {
    const page = findPage(`/${params.section}/${params.slug}`);
    return {
      meta: page
        ? [
            { title: `${page.frontmatter.title} — Solid Base` },
            { name: 'description', content: page.frontmatter.description ?? '' },
          ]
        : [],
    };
  },
  component: () => {
    const data = Route.useLoaderData();
    return <DocPage route={data().route} />;
  },
});
