import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Icon />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root>
        <NavigationMenu.Item>
          <NavigationMenu.Icon {...props} />
        </NavigationMenu.Item>
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLSpanElement },
  );

  it('renders an aria-hidden arrow by default', () => {
    render(() => (
      <NavigationMenu.Root>
        <NavigationMenu.Item>
          <NavigationMenu.Icon data-testid="icon" />
        </NavigationMenu.Item>
      </NavigationMenu.Root>
    ));
    const icon = screen.getByTestId('icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon.textContent).toBe('▼');
  });

  it('throws a descriptive error when rendered outside <NavigationMenu.Item>', () => {
    render(() => (
      <Errored fallback={(error) => <output data-testid="error">{String(error())}</output>}>
        <NavigationMenu.Root>
          <NavigationMenu.Icon />
        </NavigationMenu.Root>
      </Errored>
    ));
    expect(screen.getByTestId('error').textContent).toBe(
      `Error: ${'Base UI: NavigationMenuItem parts must be used within a <NavigationMenu.Item>.'}`,
    );
  });
});
