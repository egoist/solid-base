import { render, screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '..';
import { act, renderWithUser } from '../test-utils';

function OpenMenu(props: { children: any }) {
  return (
    <Menu.Root open>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>{props.children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe('<Menu.LinkItem />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <OpenMenu>
          <Menu.LinkItem
            href="#one"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.highlighted ? 'highlighted' : 'link')}
            style={{ color: 'red' }}
            render={(props) => <a data-custom="" {...props} />}
          >
            Link
          </Menu.LinkItem>
        </OpenMenu>
      ));

      const link = screen.getByRole('menuitem');
      expect(ref).toBe(link);
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('data-custom');
      expect(link).toHaveAttribute('href', '#one');
      expect(link).toHaveClass('link');
      expect(link.style.color).toBe('red');
    });

    it('renders an anchor with role menuitem', () => {
      render(() => (
        <OpenMenu>
          <Menu.LinkItem href="#one">Link</Menu.LinkItem>
        </OpenMenu>
      ));
      const link = screen.getByRole('menuitem');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('rendering links', () => {
    it('activates the link on click and keeps the menu open by default', async () => {
      const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.LinkItem href="#two" onClick={onClick}>
                  Link
                </Menu.LinkItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      await user.click(screen.getByRole('button', { name: 'Open' }));
      const link = await screen.findByRole('menuitem');
      await user.click(link);
      await act(() => {});
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('closes the menu on click with `closeOnClick`', async () => {
      const { user } = renderWithUser(() => (
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.LinkItem
                  href="#two"
                  closeOnClick
                  onClick={(event) => event.preventDefault()}
                >
                  Link
                </Menu.LinkItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      await user.click(screen.getByRole('button', { name: 'Open' }));
      const link = await screen.findByRole('menuitem');
      await user.click(link);
      await waitFor(() => expect(screen.queryByRole('menu')).toBe(null));
    });

    // Skipped: upstream uses react-router links and real-browser keyboard activation of anchors.
    it.skip('react-router <Link> activates with Enter and Space', () => {});
    // Skipped: relies on real browser typeahead timing and link navigation.
    it.skip('does not navigate when Space is pressed during an active typeahead session', () => {});
  });
});
