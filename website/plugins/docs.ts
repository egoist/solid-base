/**
 * Turns the Markdown documentation in `../docs` into modules the website renders.
 *
 * - `import page from '<docs>/components/switch/index.md'` exports `{ frontmatter, toc, segments }`.
 *   Segments are pre-rendered HTML, live demos (`::demo{src="./demos/hero.tsx"}`) and API
 *   reference slots (`::api`).
 * - `virtual:docs` exports the index of every page (route, section, frontmatter, lazy loader).
 * - `import snippet from './file.tsx?highlight'` exports `{ html, source, lang }`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import { parse as parseYaml } from 'yaml';
import {
  createCssVariablesTheme,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from 'shiki';

const theme = createCssVariablesTheme({
  name: 'solid-base',
  variablePrefix: '--code-',
  variableDefaults: {},
  fontStyle: true,
});

const LANGS = ['tsx', 'ts', 'jsx', 'js', 'css', 'html', 'bash', 'json', 'yaml', 'diff'] as const;

let highlighterPromise: Promise<Highlighter> | undefined;
function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: [theme], langs: [...LANGS] });
  return highlighterPromise;
}

const LANG_ALIASES: Record<string, string> = { sh: 'bash', shell: 'bash', zsh: 'bash' };

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[char]};`);
}

export async function highlight(code: string, lang = 'tsx') {
  const highlighter = await getHighlighter();
  const resolved = LANG_ALIASES[lang] ?? lang;
  const language = (LANGS as readonly string[]).includes(resolved) ? resolved : 'text';
  return highlighter.codeToHtml(code.replace(/\n$/, ''), {
    lang: language as BundledLanguage,
    theme: 'solid-base',
  });
}

/** A code figure with an optional title and a copy button, styled by the website. */
function codeFigure(html: string, source: string, lang: string, title?: string) {
  const header = title
    ? `<figcaption><span class="code-title">${escapeHtml(title)}</span><span class="code-lang">${escapeHtml(lang)}</span></figcaption>`
    : '';
  return `<figure class="code" data-lang="${escapeHtml(lang)}">${header}<button type="button" class="code-copy" aria-label="Copy code" data-copy="${escapeHtml(source)}"></button>${html}</figure>`;
}

interface TocEntry {
  id: string;
  text: string;
  depth: number;
}

type Segment =
  | { type: 'html'; html: string }
  | { type: 'demo'; component: string; files: string[] }
  | { type: 'api'; module: unknown };

interface DocsPluginOptions {
  /** The Markdown root. */
  docsDir: string;
  /** The generated API reference (`scripts/generate-api.ts`), embedded into `::api` segments. */
  apiFile: string;
}

const SECTION_TITLES: Record<string, string> = {
  overview: 'Overview',
  handbook: 'Handbook',
  components: 'Components',
  utils: 'Utilities',
};
const SECTION_ORDER = Object.keys(SECTION_TITLES);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function readFrontmatter(file: string): Record<string, any> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'));
  return match ? (parseYaml(match[1]!) ?? {}) : {};
}

function routeOf(docsDir: string, file: string) {
  const path = relative(docsDir, file).replace(/\\/g, '/').replace(/\.md$/, '');
  return `/${path.replace(/(^|\/)index$/, '')}`;
}

export function docs(options: DocsPluginOptions): Plugin {
  const docsDir = resolve(options.docsDir);
  const VIRTUAL_INDEX = 'virtual:docs';
  const HIGHLIGHT_PREFIX = '\0highlight:';
  const RESOLVED_INDEX = `\0${VIRTUAL_INDEX}`;

  async function renderMarkdown(file: string, addWatchFile: (path: string) => void) {
    const source = readFileSync(file, 'utf8');
    const toc: TocEntry[] = [];
    const segments: Segment[] = [];
    const imports: string[] = [];
    let frontmatter: Record<string, any> = {};

    const processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkGfm)
      .use(remarkDirective)
      .use(() => (tree: any) => {
        visit(tree, 'yaml', (node: any) => {
          frontmatter = parseYaml(node.value) ?? {};
        });
        visit(tree, (node: any) => {
          if (node.type === 'leafDirective' && (node.name === 'demo' || node.name === 'api')) {
            // Rendered as a marker the HTML is split on.
            node.data = {
              hName: 'segment-marker',
              hProperties: { kind: node.name, ...node.attributes },
            };
          }
          if (node.type === 'containerDirective') {
            const kind = ['note', 'tip', 'warning', 'solid'].includes(node.name) ? node.name : 'note';
            const label = node.children[0]?.data?.directiveLabel
              ? node.children.shift()
              : undefined;
            node.data = {
              hName: 'aside',
              hProperties: { className: ['callout', `callout-${kind}`] },
            };
            if (label) {
              node.children.unshift({
                type: 'paragraph',
                data: { hProperties: { className: ['callout-title'] } },
                children: label.children,
              });
            }
          }
        });
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeSlug)
      .use(() => (tree: any) => {
        visit(tree, 'element', (node: any) => {
          if (node.tagName === 'h2' || node.tagName === 'h3') {
            toc.push({
              id: node.properties.id,
              text: hastToString(node),
              depth: Number(node.tagName[1]),
            });
            // A self-link on every section heading.
            node.children.push({
              type: 'element',
              tagName: 'a',
              properties: { href: `#${node.properties.id}`, className: ['heading-anchor'], ariaLabel: 'Link to this section' },
              children: [{ type: 'text', value: '#' }],
            });
          }
        });
      })
      .use(rehypeStringify, { allowDangerousHtml: true });

    // Highlight code blocks up front: remark-rehype keeps `html` nodes verbatim.
    const tree = processor.parse(source);
    const codeBlocks: any[] = [];
    visit(tree, 'code', (node: any) => {
      codeBlocks.push(node);
    });
    for (const node of codeBlocks) {
      const lang = node.lang ?? 'text';
      const title = /title="([^"]*)"/.exec(node.meta ?? '')?.[1];
      const html = await highlight(node.value, lang);
      node.type = 'html';
      node.value = codeFigure(html, node.value, LANG_ALIASES[lang] ?? lang, title);
    }
    const hast = await processor.run(tree);
    const html = processor.stringify(hast) as string;

    // Split the rendered HTML on demo/API markers.
    const markerPattern = /<segment-marker([^>]*)><\/segment-marker>/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = markerPattern.exec(html))) {
      if (match.index > last) {
        segments.push({ type: 'html', html: html.slice(last, match.index) });
      }
      const attributes = Object.fromEntries(
        [...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key!, value!]),
      );
      if (attributes.kind === 'demo') {
        const demoFile = resolve(dirname(file), attributes.src!);
        const demoSource = readFileSync(demoFile, 'utf8');
        addWatchFile(demoFile);
        const files = [demoFile];
        for (const [, css] of demoSource.matchAll(/import\s+\w+\s+from\s+'(\.[^']+\.css)'/g)) {
          files.push(resolve(dirname(demoFile), css!));
        }
        const index = imports.length;
        imports.push(`import Demo${index} from ${JSON.stringify(demoFile)};`);
        const highlighted = await Promise.all(
          files.map(async (path) => {
            const code = readFileSync(path, 'utf8');
            const lang = extname(path).slice(1);
            return { name: basename(path), lang, source: code, html: await highlight(code, lang) };
          }),
        );
        segments.push({
          type: 'demo',
          component: `__DEMO_${index}__`,
          files: highlighted as any,
        });
      } else {
        // `::api{module="dialog" parts="Root, Trigger"}`; the module defaults to the page's folder.
        const slug = attributes.module ?? basename(dirname(file));
        addWatchFile(options.apiFile);
        const api = JSON.parse(readFileSync(options.apiFile, 'utf8'));
        const module = api[slug];
        if (!module) {
          throw new Error(`No API reference for "${slug}" (in ${relative(docsDir, file)})`);
        }
        const parts = attributes.parts?.split(',').map((part) => part.trim());
        segments.push({
          type: 'api',
          module: parts
            ? { ...module, parts: module.parts.filter((part: { name: string }) => parts.includes(part.name)) }
            : module,
        });
      }
      last = match.index + match[0].length;
    }
    if (last < html.length) {
      segments.push({ type: 'html', html: html.slice(last) });
    }

    const body = JSON.stringify({ frontmatter, toc, segments }).replace(
      /"__DEMO_(\d+)__"/g,
      (_, index) => `Demo${index}`,
    );
    return `${imports.join('\n')}\nexport default ${body};\n`;
  }

  function renderIndex() {
    const pages = walk(docsDir)
      .filter((file) => file.endsWith('.md') && basename(file) !== 'README.md')
      .map((file) => {
        const route = routeOf(docsDir, file);
        const section = route.split('/')[1] ?? '';
        const frontmatter = readFrontmatter(file);
        return { file, route, section, frontmatter };
      })
      .sort((a, b) => {
        const sectionDelta = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
        if (sectionDelta !== 0) {
          return sectionDelta;
        }
        const orderA = a.frontmatter.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.frontmatter.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB || String(a.frontmatter.title).localeCompare(String(b.frontmatter.title));
      });

    const entries = pages.map(
      ({ file, route, section, frontmatter }) =>
        `{ route: ${JSON.stringify(route)}, section: ${JSON.stringify(section)}, frontmatter: ${JSON.stringify(frontmatter)}, load: () => import(${JSON.stringify(file)}) }`,
    );
    const sections = SECTION_ORDER.map((key) => ({ key, title: SECTION_TITLES[key] }));
    return `export const sections = ${JSON.stringify(sections)};\nexport const pages = [\n  ${entries.join(',\n  ')}\n];\n`;
  }

  return {
    name: 'solid-base-docs',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === VIRTUAL_INDEX) {
        return RESOLVED_INDEX;
      }
      // A virtual `.js` id, so CSS plugins don't treat `styles.css?highlight` as a stylesheet.
      if (id.endsWith('?highlight') && importer) {
        const path = resolve(dirname(importer), id.slice(0, -'?highlight'.length));
        return `${HIGHLIGHT_PREFIX}${path}.js`;
      }
      return undefined;
    },
    async load(id) {
      if (id === RESOLVED_INDEX) {
        for (const file of walk(docsDir)) {
          this.addWatchFile(file);
        }
        return renderIndex();
      }
      if (id.startsWith(HIGHLIGHT_PREFIX)) {
        const path = id.slice(HIGHLIGHT_PREFIX.length, -'.js'.length);
        this.addWatchFile(path);
        const source = readFileSync(path, 'utf8');
        const lang = extname(path).slice(1);
        const html = await highlight(source, lang);
        return `export default ${JSON.stringify({ html, source, lang })};`;
      }
      const path = id.split('?')[0];
      if (path?.endsWith('.md') && path.startsWith(docsDir)) {
        return renderMarkdown(path, (watched) => this.addWatchFile(watched));
      }
      return undefined;
    },
    configureServer(server) {
      // Adding, removing or renaming pages changes the index: invalidate it and reload.
      server.watcher.add(docsDir);
      const refreshIndex = (file: string) => {
        if (!file.startsWith(docsDir) || !file.endsWith('.md')) {
          return;
        }
        for (const environment of Object.values(server.environments)) {
          const index = environment.moduleGraph.getModuleById(RESOLVED_INDEX);
          if (index) {
            environment.moduleGraph.invalidateModule(index);
          }
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refreshIndex);
      server.watcher.on('unlink', refreshIndex);
    },
    handleHotUpdate(context) {
      // Frontmatter edits change the index too.
      if (context.file.startsWith(docsDir) && context.file.endsWith('.md')) {
        for (const environment of Object.values(context.server.environments)) {
          const index = environment.moduleGraph.getModuleById(RESOLVED_INDEX);
          if (index) {
            environment.moduleGraph.invalidateModule(index);
          }
        }
      }
    },
  };
}
