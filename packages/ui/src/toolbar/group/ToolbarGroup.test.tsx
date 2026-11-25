import { render, screen } from '@solidjs/testing-library';
import { Toolbar } from '..';

describe('<Toolbar.Group />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toolbar.Root>
        <Toolbar.Group
          ref={(el) => {
            ref = el;
          }}
          class={(state) => `orientation-${state.orientation}`}
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Toolbar.Root>
    ));
    const group = screen.getByRole('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('orientation-horizontal');
    expect(group).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(group).toHaveAttribute('data-orientation', 'horizontal');
  });

  describe('ARIA attributes', () => {
    it('renders a group', () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group data-testid="group" />
        </Toolbar.Root>
      ));

      expect(screen.getByTestId('group')).toBe(screen.getByRole('group'));
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links in the group', () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group disabled>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input value="" />
          </Toolbar.Group>
        </Toolbar.Root>
      ));

      [screen.getByRole('button'), screen.getByRole('textbox')].forEach((toolbarItem) => {
        expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
        expect(toolbarItem).toHaveAttribute('data-disabled');
      });

      expect(screen.getByText('Link')).not.toHaveAttribute('data-disabled');
      expect(screen.getByText('Link')).not.toHaveAttribute('aria-disabled');
    });
  });
});
