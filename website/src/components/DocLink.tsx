import { omit } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { JSX } from '@solidjs/web';

type DocLinkProps = {
  route: string;
  children?: JSX.Element;
} & Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>;

/** A typed router link to a documentation page, from its route (`/components/switch`). */
export function DocLink(props: DocLinkProps) {
  const anchorProps = omit(props, 'route', 'children');
  const params = () => {
    const [, section = '', slug = ''] = props.route.split('/');
    return { section, slug };
  };
  return (
    <Link {...(anchorProps as Record<string, unknown>)} to="/$section/$slug" params={params()}>
      {props.children}
    </Link>
  );
}
