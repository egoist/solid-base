import { Errored, createSignal } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { ContextMenu } from '../../context-menu';
import { Menu } from '..';
import { Menubar } from '../../menubar';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { positionerConformanceTests } from '../../popover/anchoredPopupTestUtils';
import { act } from '../test-utils';

const createAnchorPositioningSpy = vi.hoisted(() => vi.fn());

vi.mock('../../internals/anchorPositioning', async () => {
  const actual = await vi.importActual<typeof import('../../internals/anchorPositioning')>(
    '../../internals/anchorPositioning',
  );

  return {
    ...actual,
    createAnchorPositioning: ((...args: Parameters<typeof actual.createAnchorPositioning>) => {
      createAnchorPositioningSpy(...args);
      return actual.createAnchorPositioning(...args);
    }) satisfies typeof actual.createAnchorPositioning,
  };
});

describe('<Menu.Positioner />', () => {
  beforeEach(() => {
    createAnchorPositioningSpy.mockClear();
  });

  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner
              data-testid="positioner"
              ref={(el) => {
                ref = el;
              }}
              class={(state) => (state.open ? 'positioner open' : 'positioner')}
              style={{ color: 'red' }}
              render={(props, state) => (
                <section {...props} data-state-nested={String(state.nested)} />
              )}
            >
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const positioner = screen.getByTestId('positioner');
      expect(ref).toBe(positioner);
      expect(positioner.tagName).toBe('SECTION');
      expect(positioner).toHaveClass('positioner', 'open');
      expect(positioner.style.color).toBe('red');
      expect(positioner).toHaveAttribute('data-state-nested', 'false');
      expect(positioner).toHaveAttribute('role', 'presentation');
    });

    it('renders a div by default', () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner" />
          </Menu.Portal>
        </Menu.Root>
      ));
      expect(screen.getByTestId('positioner')).toBeInstanceOf(window.HTMLDivElement);
    });
  });

  it('throws when rendered outside Menu.Portal', () => {
    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Menu.Root open>
          <Menu.Positioner />
        </Menu.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error')).toHaveTextContent('Base UI: <Menu.Portal> is missing.');
  });

  it('enables lazy flipping for a filter menu', () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    // `'placement'` and not `true`: the filter menu locks the alignment as well as the side, so a
    // popup that flipped once does not jitter back while typing resizes it.
    expect(createAnchorPositioningSpy.mock.lastCall?.[0].lazyFlip).toBe('placement');
  });

  describe('collision avoidance', () => {
    function SubmenuApp(props: {
      collisionAvoidance?: Menu.Positioner.Props['collisionAvoidance'];
    }) {
      return (
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot open>
                  <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      data-testid="submenu-positioner"
                      collisionAvoidance={props.collisionAvoidance}
                    >
                      <Menu.Popup />
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    function lastCallFor(positioner: HTMLElement) {
      const calls = createAnchorPositioningSpy.mock.calls.filter(
        ([params]) => params.interactionStore.select('positionerElement') === positioner,
      );
      return calls[calls.length - 1]?.[0];
    }

    it('uses the dropdown default for a context menu', () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger>Area</ContextMenu.Trigger>
          <ContextMenu.Portal keepMounted>
            <ContextMenu.Positioner data-testid="positioner">
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      expect(lastCallFor(screen.getByTestId('positioner'))?.collisionAvoidance).toEqual(
        DROPDOWN_COLLISION_AVOIDANCE,
      );
    });

    it('uses the dropdown default for a menubar menu', () => {
      render(() => (
        <Menubar>
          <Menu.Root open>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>
      ));

      expect(lastCallFor(screen.getByTestId('positioner'))?.collisionAvoidance).toEqual(
        DROPDOWN_COLLISION_AVOIDANCE,
      );
    });

    it('uses the popup default for a submenu', () => {
      render(() => <SubmenuApp />);

      expect(lastCallFor(screen.getByTestId('submenu-positioner'))?.collisionAvoidance).toEqual(
        POPUP_COLLISION_AVOIDANCE,
      );
    });

    it('uses the collisionAvoidance prop over the default', () => {
      const collisionAvoidance = { side: 'none', align: 'none' } as const;
      render(() => <SubmenuApp collisionAvoidance={collisionAvoidance} />);

      expect(lastCallFor(screen.getByTestId('submenu-positioner'))?.collisionAvoidance).toBe(
        collisionAvoidance,
      );
    });
  });

  it('leaves lazy flipping off for a plain menu', () => {
    render(() => (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    expect(createAnchorPositioningSpy.mock.lastCall?.[0].lazyFlip).toBe(false);
  });

  describe('layout viewport', () => {
    it('uses the layout viewport for a root context menu', () => {
      render(() => (
        <ContextMenu.Root open>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>Popup</ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      expect(createAnchorPositioningSpy.mock.lastCall?.[0].shift).toEqual({
        crossAxis: true,
        rootBoundary: 'layoutViewport',
      });
    });

    it('disables cross-axis shifting when side collision avoidance is flip', () => {
      render(() => (
        <ContextMenu.Root open>
          <ContextMenu.Portal>
            <ContextMenu.Positioner collisionAvoidance={{ side: 'flip' }}>
              <ContextMenu.Popup>Popup</ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      expect(createAnchorPositioningSpy.mock.lastCall?.[0].shift).toEqual({
        crossAxis: false,
        rootBoundary: 'layoutViewport',
      });
    });

    it('preserves explicit context-menu placement and offsets', () => {
      render(() => (
        <ContextMenu.Root open>
          <ContextMenu.Portal>
            <ContextMenu.Positioner side="right" align="center" sideOffset={11} alignOffset={13}>
              <ContextMenu.Popup>Popup</ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const params = createAnchorPositioningSpy.mock.lastCall?.[0];
      expect({
        side: params.side,
        align: params.align,
        sideOffset: params.sideOffset,
        alignOffset: params.alignOffset,
      }).toEqual({
        side: 'right',
        align: 'center',
        sideOffset: 11,
        alignOffset: 13,
      });
    });

    it('uses the visual viewport for a context menu submenu', () => {
      render(() => (
        <ContextMenu.Root open>
          <ContextMenu.SubmenuRoot defaultOpen>
            <ContextMenu.Portal>
              <ContextMenu.Positioner>
                <ContextMenu.Popup>Popup</ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.SubmenuRoot>
        </ContextMenu.Root>
      ));

      expect(createAnchorPositioningSpy).toHaveBeenCalled();
      expect(createAnchorPositioningSpy.mock.lastCall?.[0].shift).toBe(undefined);
    });
  });

  it('closes an open submenu with a sibling reason when its controlled parent closes', async () => {
    const onSubmenuOpenChange = vi.fn();
    let closeParent = () => {};

    function Test() {
      const [open, setOpen] = createSignal(true);
      closeParent = () => setOpen(false);

      return (
        <Menu.Root open={open()}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot defaultOpen onOpenChange={onSubmenuOpenChange}>
                  <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup" />
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    render(() => <Test />);
    expect(screen.queryByTestId('submenu-popup')).not.toBe(null);

    await act(() => {
      closeParent();
    });

    await waitFor(() => {
      expect(onSubmenuOpenChange.mock.lastCall?.[0]).toBe(false);
    });
    expect(onSubmenuOpenChange.mock.lastCall?.[1].reason).toBe('sibling-open');
  });

  // Skipped: upstream runs these only in a real browser; they compare the positioner transform
  // against the anchor's measured rect (jsdom has no layout).
  it.skip('prop: anchor (ref, element, function, virtual element, changing anchors) (requires layout)', () => {});

  // Skipped: upstream runs these only in a real browser (native clicks + accessibility tree).
  it.skip('prop: keepMounted (requires a real browser)', () => {});

  // Skipped: upstream runs these only in a real browser; the `sideOffset` callback data comes
  // from the computed (laid out) placement.
  it.skip('Menubar parent: default side (requires layout)', () => {});

  positionerConformanceTests({
    viewport: true,
    defaultCollisionAvoidance: 'dropdown',
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        <Menu.Trigger {...props.trigger} render="div" nativeButton={false}>
          Trigger
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner {...props.positioner}>
            <Menu.Popup {...props.popup}>
              {props.viewport ? <Menu.Viewport>Popup</Menu.Viewport> : 'Popup'}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  });
});
