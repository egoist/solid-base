import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

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

describe('<NavigationMenu.Positioner />', () => {
  beforeEach(() => {
    createAnchorPositioningSpy.mockClear();
  });

  describeConformance(
    (props) => (
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner {...props} />
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLDivElement },
  );

  it('uses the layout viewport', () => {
    render(() => (
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner />
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));

    expect(createAnchorPositioningSpy.mock.lastCall?.[0].shift).toEqual({
      rootBoundary: 'layoutViewport',
    });
  });

  it('throws a descriptive error when rendered outside <NavigationMenu.Portal>', () => {
    render(() => (
      <Errored fallback={(error) => <output data-testid="error">{String(error())}</output>}>
        <NavigationMenu.Root value="test">
          <NavigationMenu.Positioner />
        </NavigationMenu.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error').textContent).toBe(
      `Error: ${'Base UI: <NavigationMenu.Portal> is missing.'}`,
    );
  });
});
