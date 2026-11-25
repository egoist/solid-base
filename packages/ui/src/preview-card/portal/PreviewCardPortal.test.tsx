import { render, screen } from '@solidjs/testing-library';
import { PreviewCard } from '..';

describe('<PreviewCard.Portal />', () => {
  it('forwards ref, class, style and renders a portal container into the body', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <PreviewCard.Root open>
        <PreviewCard.Portal
          keepMounted
          data-testid="portal"
          ref={(el) => {
            ref = el;
          }}
          class="portal"
          style={{ color: 'red' }}
        >
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup" />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    const portal = screen.getByTestId('portal');
    expect(ref).toBe(portal);
    expect(portal).toBeInstanceOf(window.HTMLDivElement);
    expect(portal.parentElement).toBe(document.body);
    expect(portal).toHaveClass('portal');
    expect(portal).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(portal).toContainElement(screen.getByTestId('popup'));
  });

  it('keeps the portal mounted while closed with keepMounted', () => {
    render(() => (
      <PreviewCard.Root>
        <PreviewCard.Portal keepMounted data-testid="portal">
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup" />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    expect(screen.getByTestId('portal')).toBeInTheDocument();
    expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
  });

  it('renders into a custom container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal container={container}>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="popup" />
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      expect(container).toContainElement(screen.getByTestId('popup'));
    } finally {
      container.remove();
    }
  });
});
