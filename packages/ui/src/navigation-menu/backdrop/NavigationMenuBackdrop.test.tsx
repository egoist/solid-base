import { render, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Backdrop />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root>
        <NavigationMenu.Backdrop {...props} />
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLDivElement },
  );

  it('is hidden while the menu is closed and shows the open state when open', () => {
    render(() => (
      <>
        <NavigationMenu.Root>
          <NavigationMenu.Backdrop data-testid="closed" />
        </NavigationMenu.Root>
        <NavigationMenu.Root value="item">
          <NavigationMenu.Backdrop data-testid="open" />
        </NavigationMenu.Root>
      </>
    ));
    const closed = screen.getByTestId('closed');
    expect(closed).toHaveAttribute('hidden');
    expect(closed).toHaveAttribute('data-closed');
    expect(closed).toHaveAttribute('role', 'presentation');
    const open = screen.getByTestId('open');
    expect(open).not.toHaveAttribute('hidden');
    expect(open).toHaveAttribute('data-open');
  });
});
