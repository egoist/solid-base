import { Switch } from '@egoist/solid-base/switch';
import { setTheme, theme } from '../lib/theme';
import { MoonIcon, SunIcon } from './icons';

/** The light/dark switch, built with the library's Switch. */
export function ThemeSwitch() {
  return (
    <Switch.Root
      class="theme-switch"
      aria-label="Light theme"
      checked={theme() === 'light'}
      onCheckedChange={(checked) => setTheme(checked ? 'light' : 'dark')}
    >
      <Switch.Thumb class="theme-switch-thumb">
        {theme() === 'light' ? <SunIcon width="12" height="12" /> : <MoonIcon width="12" height="12" />}
      </Switch.Thumb>
    </Switch.Root>
  );
}
