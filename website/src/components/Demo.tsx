import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Tabs } from '@egoist/solid-base/tabs';
import type { HighlightedFile } from '../lib/docs';

/**
 * A specimen frame: the live demo on a dotted stage with crop marks, and its source files in
 * tabs. Built with the library's Tabs.
 */
export function Demo(props: { files: HighlightedFile[]; children: JSX.Element }) {
  return (
    <Tabs.Root class="demo" defaultValue="preview">
      <div class="demo-bar">
        <Tabs.List class="demo-tabs" aria-label="Demo">
          <Tabs.Tab class="demo-tab" value="preview">
            Preview
          </Tabs.Tab>
          <For each={props.files}>
            {(file) => (
              <Tabs.Tab class="demo-tab" value={file.name}>
                {file.name}
              </Tabs.Tab>
            )}
          </For>
          <Tabs.Indicator class="demo-tab-indicator" />
        </Tabs.List>
      </div>
      <Tabs.Panel class="demo-stage" value="preview" keepMounted>
        <span class="crop crop-tl" aria-hidden="true" />
        <span class="crop crop-tr" aria-hidden="true" />
        <span class="crop crop-bl" aria-hidden="true" />
        <span class="crop crop-br" aria-hidden="true" />
        <div class="demo-preview">{props.children}</div>
      </Tabs.Panel>
      <For each={props.files}>
        {(file) => (
          <Tabs.Panel class="demo-code" value={file.name}>
            <button
              type="button"
              class="code-copy"
              aria-label="Copy code"
              data-copy={file.source}
            />
            <div innerHTML={file.html} />
          </Tabs.Panel>
        )}
      </For>
    </Tabs.Root>
  );
}
