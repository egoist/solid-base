import { render, screen } from '@solidjs/testing-library';
import { Meter } from '..';

describe('<Meter.Indicator />', () => {
  it('renders a div with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Meter.Root value={30}>
        <Meter.Track data-testid="track">
          <Meter.Indicator
            data-testid="indicator"
            class="indicator"
            style={{ color: 'red' }}
            ref={(element) => {
              refElement = element;
            }}
          />
          <Meter.Indicator render="span" data-testid="span" />
        </Meter.Track>
      </Meter.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator.tagName).toBe('DIV');
    expect(indicator).toHaveClass('indicator');
    expect(indicator.style.color).toBe('red');
    expect(indicator.style.width).toBe('30%');
    expect(refElement).toBe(indicator);
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
    expect(screen.getByTestId('track').tagName).toBe('DIV');
  });

  describe('value bounds', () => {
    it('clamps the width to 100% when the value exceeds max', () => {
      render(() => (
        <Meter.Root value={150}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('100%');
    });

    it('clamps the width to 0% when the value is below min', () => {
      render(() => (
        <Meter.Root value={-10}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('0%');
    });

    it('produces a finite width when min equals max', () => {
      render(() => (
        <Meter.Root value={5} min={5} max={5}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('0%');
    });
  });

  // Computed style assertions need a real browser; jsdom only checks the inline styles.
  it('sets positioning styles', () => {
    render(() => (
      <Meter.Root value={33}>
        <Meter.Track>
          <Meter.Indicator data-testid="indicator" />
        </Meter.Track>
      </Meter.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.getPropertyValue('inset-inline-start')).toBe('0px');
    expect(indicator.style.height).toBe('inherit');
    expect(indicator.style.width).toBe('33%');
  });
});
