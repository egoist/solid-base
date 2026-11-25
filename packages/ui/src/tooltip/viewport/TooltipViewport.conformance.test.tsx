import { For } from 'solid-js';
import { Tooltip } from '..';
import { viewportConformanceTests } from '../../popover/anchoredPopupTestUtils';

describe('<Tooltip.Viewport /> conformance', () => {
  viewportConformanceTests({
    openOn: 'focus',
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        {(arg: { readonly payload: unknown }) => (
          <>
            <For each={props.triggers}>
              {(trigger) => (
                <Tooltip.Trigger
                  delay={0}
                  id={trigger.id}
                  payload={trigger.payload}
                  data-testid={trigger['data-testid']}
                  style={trigger.style}
                >
                  {trigger.children}
                </Tooltip.Trigger>
              )}
            </For>
            <Tooltip.Portal {...props.portal}>
              <Tooltip.Positioner {...props.positioner}>
                <Tooltip.Popup {...props.popup}>
                  <Tooltip.Viewport {...props.viewport}>
                    {props.renderContent(arg.payload)}
                  </Tooltip.Viewport>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </>
        )}
      </Tooltip.Root>
    ),
  });
});
