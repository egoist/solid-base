import { For } from 'solid-js';
import { PreviewCard } from '..';
import { viewportConformanceTests } from '../../popover/anchoredPopupTestUtils';

describe('<PreviewCard.Viewport /> conformance', () => {
  viewportConformanceTests({
    openOn: 'focus',
    createComponent: (props) => (
      <PreviewCard.Root {...props.root}>
        {(arg: { readonly payload: unknown }) => (
          <>
            <For each={props.triggers}>
              {(trigger) => (
                <PreviewCard.Trigger
                  href="#" delay={0}
                  id={trigger.id}
                  payload={trigger.payload}
                  data-testid={trigger['data-testid']}
                  style={trigger.style}
                >
                  {trigger.children}
                </PreviewCard.Trigger>
              )}
            </For>
            <PreviewCard.Portal {...props.portal}>
              <PreviewCard.Positioner {...props.positioner}>
                <PreviewCard.Popup {...props.popup}>
                  <PreviewCard.Viewport {...props.viewport}>
                    {props.renderContent(arg.payload)}
                  </PreviewCard.Viewport>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </>
        )}
      </PreviewCard.Root>
    ),
  });
});
