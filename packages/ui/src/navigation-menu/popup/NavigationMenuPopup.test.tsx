import { render, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { describeConformance } from '../test-utils';

describe('<NavigationMenu.Popup />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup {...props} />
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLElement },
  );

  it('renders a focusable <nav> with an id and side/align attributes', () => {
    render(() => (
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner side="top">
            <NavigationMenu.Popup data-testid="popup" />
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));
    const popup = screen.getByTestId('popup');
    expect(popup.tagName).toBe('NAV');
    expect(popup).toHaveAttribute('tabindex', '-1');
    expect(popup.id).not.toBe('');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'top');
    // Anchored to the bottom edge so size transitions grow upwards.
    expect(popup.style.position).toBe('absolute');
    expect(popup.style.bottom).toBe('0px');
  });
});
