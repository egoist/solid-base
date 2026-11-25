import { createContext, type Component } from 'solid-js';
import type { MenuFilterProviderOptions } from './MenuFilterProviderOptions';

/**
 * What `Menu.FilterProvider` hands to the root directly inside it: the filterable root
 * implementations (the provider is their only importer) and the filter props.
 */
export interface MenuFilterProviderContext {
  Root: Component<any>;
  SubmenuRoot: Component<any>;
  /** The filter props (a live object of getters). */
  options: MenuFilterProviderOptions;
}

/**
 * Non-null only directly below a provider. The root that consumes it resets it, so a plain
 * `Menu.SubmenuRoot` inside a filterable menu stays plain.
 */
export const MenuFilterProviderContext = createContext<MenuFilterProviderContext | null>(null);
