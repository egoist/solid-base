import { render, screen, waitFor } from '@solidjs/testing-library';
import { PreviewCard } from '..';
import { renderWithUser } from '../../dialog/test-utils';

describe('<PreviewCard.Backdrop />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Backdrop
            data-testid="backdrop"
            ref={(el) => {
              ref = el;
            }}
            class={(state) => (state.open ? 'backdrop open' : 'backdrop')}
            style={{ color: 'red' }}
            render={(props) => <section {...props} />}
          />
        </PreviewCard.Root>
      ));
      const backdrop = screen.getByTestId('backdrop');
      expect(ref).toBe(backdrop);
      expect(backdrop.tagName).toBe('SECTION');
      expect(backdrop).toHaveClass('backdrop', 'open');
      expect(backdrop).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(backdrop).toHaveAttribute('role', 'presentation');
      expect(backdrop).toHaveAttribute('data-open');
    });
  });

  it('sets `pointer-events: none` style', async () => {
    const { user } = renderWithUser(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger delay={0} closeDelay={0}>
          Open
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Backdrop data-testid="backdrop" />
          <PreviewCard.Positioner>
            <PreviewCard.Popup />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    await user.hover(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('none');
    });
  });
});
