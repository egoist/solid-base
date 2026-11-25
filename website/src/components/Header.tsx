import { Link } from '@tanstack/solid-router';
import { SearchDialog } from './SearchDialog';
import { DocLink } from './DocLink';
import { ThemeSwitch } from './ThemeSwitch';
import { MobileNav } from './MobileNav';
import { GitHubIcon } from './icons';
import { Logo } from './Logo';

export const REPOSITORY_URL = 'https://github.com/egoist/solid-base';

export function Header() {
  return (
    <header class="site-header">
      <div class="site-header-inner">
        <MobileNav />
        <Link to="/" class="wordmark" aria-label="Solid Base home">
          <Logo class="wordmark-mark" />
          <span class="wordmark-text">Solid Base</span>
        </Link>
        <nav class="site-nav" aria-label="Main">
          <DocLink route="/overview/quick-start">Guide</DocLink>
          <DocLink route="/components/accordion">Components</DocLink>
          <DocLink route="/handbook/styling">Handbook</DocLink>
          <DocLink route="/utils/merge-props">Utilities</DocLink>
        </nav>
        <div class="site-header-actions">
          <SearchDialog />
          <ThemeSwitch />
          <a class="icon-button" href={REPOSITORY_URL} aria-label="GitHub repository">
            <GitHubIcon />
          </a>
        </div>
      </div>
    </header>
  );
}
