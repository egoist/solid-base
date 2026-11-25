import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/solid-router';
import type { JSX } from '@solidjs/web';
import appCss from '../styles/app.css?url';
import { Shell } from '../components/Shell';
import { NotFound } from '../components/NotFound';
import { themeScript } from '../lib/theme';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Solid Base — Unstyled UI components for Solid' },
      {
        name: 'description',
        content: 'Unstyled, accessible UI components for SolidJS 2. A faithful port of Base UI.',
      },
      { name: 'theme-color', content: '#16171b' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Inter:opsz,wght@14..32,400..700&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
  notFoundComponent: NotFound,
});

function RootDocument(props: { children?: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <script innerHTML={themeScript} />
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
