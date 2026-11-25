import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Meter } from '..';

describe('<Meter.Value />', () => {
  it('renders a span with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Meter.Root value={30}>
        <Meter.Value
          data-testid="value"
          class="value"
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <Meter.Value render="div" data-testid="div" />
      </Meter.Root>
    ));
    const value = screen.getByTestId('value');
    expect(value.tagName).toBe('SPAN');
    expect(value).toHaveAttribute('aria-hidden', 'true');
    expect(value).toHaveClass('value');
    expect(value.style.color).toBe('red');
    expect(refElement).toBe(value);
    expect(screen.getByTestId('div').tagName).toBe('DIV');
  });

  describe('prop: children', () => {
    it('renders the value when children is not provided', () => {
      render(() => (
        <Meter.Root value={30}>
          <Meter.Value data-testid="value" />
        </Meter.Root>
      ));

      const value = screen.getByTestId('value');
      expect(value.textContent).toBe((0.3).toLocaleString(undefined, { style: 'percent' }));
    });

    it('renders a formatted value when a format is provided', () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }

      render(() => (
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value" />
        </Meter.Root>
      ));

      const value = screen.getByTestId('value');
      expect(value.textContent).toBe(formatValue(30));
    });

    it('accepts a render function', () => {
      const renderSpy = vi.fn();
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      render(() => (
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value">{renderSpy}</Meter.Value>
        </Meter.Root>
      ));
      expect(renderSpy.mock.lastCall?.[0]).toEqual(formatValue(30));
      expect(renderSpy.mock.lastCall?.[1]).toEqual(30);
    });

    it('passes updated arguments to the render function when value changes', () => {
      const renderSpy = vi.fn();
      const [value, setValue] = createSignal(30);

      render(() => (
        <Meter.Root value={value()}>
          <Meter.Value>{renderSpy}</Meter.Value>
        </Meter.Root>
      ));

      expect(renderSpy.mock.lastCall?.[0]).toEqual(
        (0.3).toLocaleString(undefined, { style: 'percent' }),
      );
      expect(renderSpy.mock.lastCall?.[1]).toEqual(30);

      setValue(60);
      flush();

      expect(renderSpy.mock.lastCall?.[0]).toEqual(
        (0.6).toLocaleString(undefined, { style: 'percent' }),
      );
      expect(renderSpy.mock.lastCall?.[1]).toEqual(60);
    });
  });

  // Skipped: the server-side rendering/hydration locale tests need a server renderer.
});
