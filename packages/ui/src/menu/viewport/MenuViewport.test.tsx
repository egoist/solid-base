import { For } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Menu } from '..';
import { viewportConformanceTests } from '../../popover/anchoredPopupTestUtils';

describe('<Menu.Viewport />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.Root open>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Viewport
                data-testid="viewport"
                ref={(el) => {
                  ref = el;
                }}
                class="viewport"
                style={{ color: 'red' }}
                render={(props) => <section {...props} />}
              >
                Content
              </Menu.Viewport>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    expect(ref).toBe(viewport);
    expect(viewport.tagName).toBe('SECTION');
    expect(viewport).toHaveClass('viewport');
    expect(viewport.style.color).toBe('red');
    expect(viewport).toHaveTextContent('Content');
  });

  viewportConformanceTests({
    openOn: 'click',
    createComponent: (props) => (
      <Menu.Root {...(props.root as Menu.Root.Props)}>
        {(arg: { readonly payload: unknown }) => (
          <>
            <For each={props.triggers}>
              {(trigger) => (
                <Menu.Trigger
                  id={trigger.id}
                  payload={trigger.payload}
                  data-testid={trigger['data-testid']}
                  style={trigger.style}
                >
                  {trigger.children}
                </Menu.Trigger>
              )}
            </For>
            <Menu.Portal {...(props.portal as Menu.Portal.Props)}>
              <Menu.Positioner {...(props.positioner as Menu.Positioner.Props)}>
                <Menu.Popup {...(props.popup as Menu.Popup.Props)}>
                  <Menu.Viewport {...(props.viewport as Menu.Viewport.Props)}>
                    {props.renderContent(arg.payload)}
                  </Menu.Viewport>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </>
        )}
      </Menu.Root>
    ),
  });
});
