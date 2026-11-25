import { createMemo, For, Match, Show, Switch } from 'solid-js';
import { dynamic } from '@solidjs/web';
import {
  findPage,
  getDocModule,
  neighbors,
  sections,
  type DocSegment,
} from '../lib/docs';
import { Sidebar } from './Sidebar';
import { Toc } from './Toc';
import { Demo } from './Demo';
import { ApiReference } from './ApiReference';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';
import { NotFound } from './NotFound';
import { DocLink } from './DocLink';

export function DocPage(props: { route: string }) {
  const entry = createMemo(() => findPage(props.route));

  return (
    <Show when={entry()} fallback={<NotFound />}>
      {(page) => {
        // Loaded by the route loader (and the client entry, before hydration).
        const module = () => getDocModule(page().route);
        const sectionTitle = () => sections.find((s) => s.key === page().section)?.title;
        const around = () => neighbors(page().route);

        return (
          <div class="docs-layout">
            <Sidebar />
            <main id="main" class="docs-main">
              <article class="doc">
                <header class="doc-header">
                  <p class="eyebrow doc-kicker">{sectionTitle()}</p>
                  <h1 class="doc-title">{page().frontmatter.title}</h1>
                  <Show when={page().frontmatter.description}>
                    <p class="doc-description">{page().frontmatter.description}</p>
                  </Show>
                </header>
                <div class="prose">
                  <For each={module()?.segments ?? []}>
                    {(segment) => <Segment segment={segment} />}
                  </For>
                </div>
                <nav class="doc-pager" aria-label="Pages">
                  <Show when={around().previous}>
                    {(previous) => (
                      <DocLink route={previous().route} class="pager-link" data-direction="previous">
                        <span class="eyebrow">
                          <ArrowLeftIcon /> Previous
                        </span>
                        <span class="pager-title">{previous().frontmatter.title}</span>
                      </DocLink>
                    )}
                  </Show>
                  <Show when={around().next}>
                    {(next) => (
                      <DocLink route={next().route} class="pager-link" data-direction="next">
                        <span class="eyebrow">
                          Next <ArrowRightIcon />
                        </span>
                        <span class="pager-title">{next().frontmatter.title}</span>
                      </DocLink>
                    )}
                  </Show>
                </nav>
              </article>
            </main>
            <aside class="docs-aside">
              <Toc entries={module()?.toc ?? []} />
            </aside>
          </div>
        );
      }}
    </Show>
  );
}

function Segment(props: { segment: DocSegment }) {
  return (
    <Switch>
      <Match when={props.segment.type === 'html' && props.segment}>
        {(segment) => <div class="prose-block" innerHTML={segment().html} />}
      </Match>
      <Match when={props.segment.type === 'demo' && props.segment}>
        {(segment) => {
          const Component = dynamic(() => segment().component);
          return (
            <Demo files={segment().files}>
              <Component />
            </Demo>
          );
        }}
      </Match>
      <Match when={props.segment.type === 'api' && props.segment}>
        {(segment) => (
          <ApiReference module={segment().module} />
        )}
      </Match>
    </Switch>
  );
}
