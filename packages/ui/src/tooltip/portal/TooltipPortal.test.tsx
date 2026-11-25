import { render, screen } from '@solidjs/testing-library';
import { Tooltip } from '..';

describe('<Tooltip.Portal />', () => {
  it('forwards ref, class, style and renders a portal container into the body', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal
          data-testid="portal"
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          style={{ color: 'red' }}
        >
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup" />
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    const portal = screen.getByTestId('portal');
    expect(ref).toBe(portal);
    expect(portal).toBeInstanceOf(window.HTMLDivElement);
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toHaveClass('portal');
    expect(portal).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(portal).toContainElement(screen.getByTestId('popup'));
  });

  describe('prop: keepMounted', () => {
    function ClosedTooltip(props: { keepMounted?: boolean }) {
      return (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal keepMounted={props.keepMounted}>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    it('renders the closed popup as hidden instead of unmounting it', () => {
      render(() => <ClosedTooltip keepMounted />);

      expect(screen.getByTestId('popup')).not.toBeVisible();
    });

    it('unmounts the closed popup by default', () => {
      render(() => <ClosedTooltip />);

      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });
});
