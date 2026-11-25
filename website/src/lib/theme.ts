import { createSignal } from 'solid-js';

export type Theme = 'dark' | 'light';

/** Applied before the first paint, from the document head. Dark is the default. */
export const themeScript = `try{if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

// Starts as `dark` on the server and during hydration; `syncTheme` reads the stored value.
const [theme, setThemeSignal] = createSignal<Theme>('dark');

export { theme };

export function syncTheme() {
  try {
    if (localStorage.getItem('theme') === 'light') {
      setThemeSignal('light');
    }
  } catch {
    // Storage may be unavailable (private mode).
  }
}

export function setTheme(next: Theme) {
  setThemeSignal(next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    // The choice still applies to this visit.
  }
  if (next === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}
