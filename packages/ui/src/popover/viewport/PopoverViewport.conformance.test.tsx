import { For } from 'solid-js';
import { Popover } from '..';
import { viewportConformanceTests } from '../anchoredPopupTestUtils';

describe('<Popover.Viewport /> conformance', () => {
  viewportConformanceTests({
    openOn: 'click',
    createComponent: (props) => (
      <Popover.Root {...props.root}>
        {(arg: { readonly payload: unknown }) => (
          <>
            <For each={props.triggers}>
              {(trigger) => (
                <Popover.Trigger
                  id={trigger.id}
                  payload={trigger.payload}
                  data-testid={trigger['data-testid']}
                  style={trigger.style}
                >
                  {trigger.children}
                </Popover.Trigger>
              )}
            </For>
            <Popover.Portal {...props.portal}>
              <Popover.Positioner {...props.positioner}>
                <Popover.Popup {...props.popup}>
                  <Popover.Viewport {...props.viewport}>
                    {props.renderContent(arg.payload)}
                  </Popover.Viewport>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </>
        )}
      </Popover.Root>
    ),
  });
});
