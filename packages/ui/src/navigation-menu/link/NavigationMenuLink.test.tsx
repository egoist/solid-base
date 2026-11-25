import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { NavigationMenu } from '..';
import { describeConformance, renderWithUser } from '../test-utils';

function MenuWithLink(props: { closeOnClick?: boolean }) {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1" closeOnClick={props.closeOnClick}>
              Link 1
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

describe('<NavigationMenu.Link />', () => {
  describeConformance(
    (props) => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Link {...props} />
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ),
    { refInstanceof: window.HTMLAnchorElement },
  );

  describe('prop: closeOnClick', () => {
    it('closes the menu when clicking a link when true', async () => {
      const { user } = renderWithUser(() => <MenuWithLink closeOnClick />);

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const link = screen.getByRole('link', { name: 'Link 1' });
      await user.click(link);

      await waitFor(() => expect(screen.queryByTestId('popup-1')).toBe(null));
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not close the menu when clicking a link when false', async () => {
      const { user } = renderWithUser(() => <MenuWithLink closeOnClick={false} />);

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const link = screen.getByRole('link', { name: 'Link 1' });
      await user.click(link);

      await waitFor(() => expect(screen.queryByTestId('popup-1')).not.toBe(null));
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('prop: active', () => {
    it('when `true`, renders with aria-current="page"', () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#" active>
                active
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      ));
      const link = screen.getByRole('link', { name: 'active' });
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('data-active');
    });

    it('when `false`, does not render with aria-current="page"', () => {
      render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#" active={false}>
                inactive
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      ));
      expect(screen.getByRole('link', { name: 'inactive' })).not.toHaveAttribute('aria-current');
    });
  });

  it('keeps the menu open when a link loses focus without a related target', async () => {
    const { user } = renderWithUser(() => <MenuWithLink />);

    const trigger = screen.getByRole('button', { name: 'Item 1' });
    await user.click(trigger);

    const link = await screen.findByRole('link', { name: 'Link 1' });
    fireEvent.focus(link);
    fireEvent.blur(link, { relatedTarget: null });

    expect(screen.getByRole('link', { name: 'Link 1' })).not.toBe(null);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
