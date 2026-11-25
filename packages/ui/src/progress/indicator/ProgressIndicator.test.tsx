import { render, screen } from '@solidjs/testing-library';
import { Progress } from '..';

describe('<Progress.Indicator />', () => {
  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Progress.Root value={40}>
        <Progress.Track data-testid="track">
          <Progress.Indicator
            data-testid="indicator"
            class="indicator"
            style={{ color: 'red' }}
            ref={(element) => {
              refElement = element;
            }}
          />
          <Progress.Indicator render="span" data-testid="span" />
        </Progress.Track>
      </Progress.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator.tagName).toBe('DIV');
    expect(indicator).toHaveClass('indicator');
    // User styles merge with the internal ones.
    expect(indicator.style.color).toBe('red');
    expect(indicator.style.width).toBe('40%');
    expect(refElement).toBe(indicator);
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
    expect(screen.getByTestId('track')).toHaveAttribute('data-progressing');
  });

  // Computed style assertions need a real browser; jsdom only checks the inline styles.
  describe('internal styles', () => {
    it('determinate', () => {
      render(() => (
        <Progress.Root value={33}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>
      ));

      const indicator = screen.getByTestId('indicator');
      expect(indicator.style.getPropertyValue('inset-inline-start')).toBe('0px');
      expect(indicator.style.width).toBe('33%');
      expect(indicator.style.height).toBe('inherit');
    });

    it('sets zero width when value is 0', () => {
      render(() => (
        <Progress.Root value={0}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('0%');
    });

    it('indeterminate', () => {
      render(() => (
        <Progress.Root value={null}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>
      ));

      expect(screen.getByTestId('indicator')).not.toHaveAttribute('style');
    });
  });
});
