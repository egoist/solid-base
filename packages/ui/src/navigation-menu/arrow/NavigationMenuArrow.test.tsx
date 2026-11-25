import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Arrow />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Arrow {...props} />
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLDivElement },
  );

  it('throws a descriptive error when rendered outside <NavigationMenu.Positioner>', () => {
    render(() => (
      <Errored fallback={(error) => <output data-testid="error">{String(error())}</output>}>
        <NavigationMenu.Root>
          <NavigationMenu.Arrow />
        </NavigationMenu.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error').textContent).toBe(
      `Error: ${'Base UI: NavigationMenuPositionerContext is missing. NavigationMenuPositioner parts must be placed within <NavigationMenu.Positioner>.'}`,
    );
  });
});
