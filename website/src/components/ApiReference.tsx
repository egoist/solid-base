import { For, Show } from 'solid-js';
import type { ApiAttribute, ApiModule } from '../lib/docs';

/** Renders inline Markdown-ish backticks from TSDoc descriptions as code. */
function Description(props: { text: string }) {
  const html = () =>
    props.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, ' ')}</p>`)
      .join('');
  return <div class="api-description" innerHTML={html()} />;
}

/** The API reference of a module, generated from the TypeScript source. */
export function ApiReference(props: { module: ApiModule }) {
  const parts = () => props.module.parts;

  return (
    <div class="api">
      <For each={parts()}>
        {(part) => (
          <section class="api-part" id={`api-${part.name.toLowerCase()}`}>
            <header class="api-part-header">
              <h3>
                {/* JSX entities: Solid 2.0.4's hydratable SSR leaves `{`<${x}>`}` unescaped. */}
                <code>
                  &lt;{part.jsxName}&gt;
                </code>
              </h3>
              <Show when={part.description}>
                <Description text={part.description} />
              </Show>
            </header>

            <Show when={part.props.length > 0}>
              <div class="api-table" role="table" aria-label={`${part.jsxName} props`}>
                <div class="api-row api-row-head" role="row">
                  <span role="columnheader">Prop</span>
                  <span role="columnheader">Type</span>
                  <span role="columnheader">Default</span>
                </div>
                <For each={part.props}>
                  {(prop) => (
                    <div class="api-row" role="row">
                      <span class="api-name" role="cell">
                        <code>{prop.name}</code>
                        <Show when={prop.required}>
                          <span class="api-required" title="Required">
                            *
                          </span>
                        </Show>
                      </span>
                      <span class="api-type" role="cell">
                        <code>{prop.type}</code>
                      </span>
                      <span class="api-default" role="cell">
                        <code>{prop.default ?? '—'}</code>
                      </span>
                      <Show when={prop.description}>
                        <div class="api-row-description" role="cell">
                          <Description text={prop.description} />
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={part.dataAttributes.length > 0}>
              <AttributeTable title="Data attribute" items={part.dataAttributes} />
            </Show>
            <Show when={part.cssVariables.length > 0}>
              <AttributeTable title="CSS variable" items={part.cssVariables} />
            </Show>
          </section>
        )}
      </For>
    </div>
  );
}

function AttributeTable(props: { title: string; items: ApiAttribute[] }) {
  return (
    <div class="api-table api-table-attributes" role="table" aria-label={`${props.title}s`}>
      <div class="api-row api-row-head" role="row">
        <span role="columnheader">{props.title}</span>
        <span role="columnheader">Description</span>
      </div>
      <For each={props.items}>
        {(item) => (
          <div class="api-row" role="row">
            <span class="api-name" role="cell">
              <code>{item.name}</code>
            </span>
            <span role="cell">
              <Description text={item.description} />
            </span>
          </div>
        )}
      </For>
    </div>
  );
}
