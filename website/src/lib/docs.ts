import type { Component } from 'solid-js';
import { pages, sections } from 'virtual:docs';

export interface DocFrontmatter {
  title: string;
  description?: string;
  order?: number;
  /** Shown in the sidebar next to the title. */
  badge?: string;
}

export interface TocEntry {
  id: string;
  text: string;
  depth: number;
}

export interface HighlightedFile {
  name: string;
  lang: string;
  source: string;
  html: string;
}

export type DocSegment =
  | { type: 'html'; html: string }
  | { type: 'demo'; component: Component; files: HighlightedFile[] }
  | { type: 'api'; module: ApiModule };

export interface ApiProp {
  name: string;
  type: string;
  default?: string;
  description: string;
  required: boolean;
}

export interface ApiAttribute {
  name: string;
  description: string;
  type?: string;
}

export interface ApiPart {
  name: string;
  jsxName: string;
  description: string;
  props: ApiProp[];
  dataAttributes: ApiAttribute[];
  cssVariables: ApiAttribute[];
}

export interface ApiModule {
  slug: string;
  name: string;
  namespaced: boolean;
  parts: ApiPart[];
}

export interface DocModule {
  frontmatter: DocFrontmatter;
  toc: TocEntry[];
  segments: DocSegment[];
}

export interface DocSection {
  key: string;
  title: string;
}

export interface DocPageEntry {
  route: string;
  section: string;
  frontmatter: DocFrontmatter;
  load: () => Promise<{ default: DocModule }>;
}

export { pages, sections };

export function findPage(route: string) {
  const normalized = route.replace(/\/+$/, '') || '/';
  return pages.find((page) => page.route === normalized);
}

export function pagesIn(section: string) {
  return pages.filter((page) => page.section === section);
}

const moduleCache = new Map<string, DocModule>();

/**
 * Loads a page's module into the cache (route loaders and the client entry await it), so
 * components read it synchronously with `getDocModule`. Resolves to `undefined` for other routes.
 */
export async function loadDocModule(route: string) {
  const page = findPage(route);
  if (!page) {
    return undefined;
  }
  // Always ask the loader: it resolves the already-loaded module (or a fresh one after an edit
  // in development) without refetching.
  const module: DocModule = (await page.load()).default;
  moduleCache.set(page.route, module);
  return module;
}

export function getDocModule(route: string) {
  return moduleCache.get(route);
}

/** Every page, in reading order, for previous/next links. */
export function neighbors(route: string) {
  const index = pages.findIndex((page) => page.route === route);
  return { previous: pages[index - 1], next: pages[index + 1] };
}

/** The component's position in the catalog, printed like a specimen number. */
export function specimenNumber(route: string) {
  const components = pagesIn('components');
  const index = components.findIndex((page) => page.route === route);
  return index === -1 ? undefined : String(index + 1).padStart(2, '0');
}
