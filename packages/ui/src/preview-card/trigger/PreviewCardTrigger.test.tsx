import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { PreviewCard } from '..';
import { renderWithUser, wait } from '../../dialog/test-utils';

describe('<PreviewCard.Trigger />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Trigger
            href="#"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'trigger open' : 'trigger')}
            style={{ color: 'red' }}
            render={(props, state) => <a {...props} data-state-open={String(state.open)} />}
          >
            Link
          </PreviewCard.Trigger>
        </PreviewCard.Root>
      ));
      const trigger = screen.getByRole('link', { name: 'Link' });
      expect(ref).toBe(trigger);
      expect(trigger).toBeInstanceOf(window.HTMLAnchorElement);
      expect(trigger).toHaveClass('trigger', 'open');
      expect(trigger).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(trigger).toHaveAttribute('data-state-open', 'true');
      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('renders an anchor by default', () => {
      render(() => (
        <PreviewCard.Root>
          <PreviewCard.Trigger href="#">Link</PreviewCard.Trigger>
        </PreviewCard.Root>
      ));
      const trigger = screen.getByRole('link', { name: 'Link' });
      expect(trigger.tagName).toBe('A');
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });
  });

  it('throws without PreviewCard.Root or a handle', () => {
    expect(() => render(() => <PreviewCard.Trigger />)).toThrow(
      'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
    );
  });

  it('stays closed when focus returns to the trigger after leaving the window, once the card has unmounted', async () => {
    const { user } = renderWithUser(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger href="#" delay={0}>
          Trigger
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    const trigger = screen.getByRole('link', { name: 'Trigger' });

    await user.keyboard('[Tab]');
    expect(trigger).toHaveFocus();
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBe(null);
    });

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    // Leaving the window blurs the trigger, then the window, while the trigger stays the active
    // element; coming back focuses the window, then the trigger.
    fireEvent.blur(trigger);
    fireEvent.blur(window);
    fireEvent.focus(window);
    fireEvent.focus(trigger);
    await wait(50);

    expect(screen.queryByTestId('popup')).toBe(null);
  });
});
