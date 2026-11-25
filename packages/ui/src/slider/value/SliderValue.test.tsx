import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Slider } from '..';

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  flush();
}

describe('<Slider.Value />', () => {
  it('renders an output and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Value
          data-testid="output"
          class={(state) => `values-${state.values.join('-')}`}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        />
        <Slider.Value render="span" data-testid="span" />
      </Slider.Root>
    ));
    const output = screen.getByTestId('output');
    expect(output.tagName).toBe('OUTPUT');
    expect(output).toHaveClass('values-50');
    expect(output.style.color).toBe('red');
    expect(output).toHaveAttribute('aria-live', 'off');
    expect(ref).toBe(output);
    expect(screen.getByTestId('span').tagName).toBe('SPAN');
  });

  it('renders a single value', () => {
    render(() => (
      <Slider.Root defaultValue={40}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    expect(screen.getByTestId('output')).toHaveTextContent('40');
  });

  it('renders a range', () => {
    render(() => (
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    expect(screen.getByTestId('output')).toHaveTextContent('40 – 65');
  });

  it('associates the output with every thumb input', async () => {
    render(() => (
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value data-testid="output" />
        <Slider.Control>
          <Slider.Thumb index={0} />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>
    ));

    // The thumbs register once mounted.
    await flushMicrotasks();

    const thumbIds = screen.getAllByRole('slider').map((thumb) => thumb.id);

    expect(thumbIds).not.toContain('');
    expect(new Set(thumbIds).size).toBe(thumbIds.length);
    expect(screen.getByTestId('output')).toHaveAttribute('for', thumbIds.join(' '));
  });

  it('renders all thumb values', () => {
    render(() => (
      <Slider.Root defaultValue={[40, 60, 80, 95]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    expect(screen.getByTestId('output')).toHaveTextContent('40 – 60 – 80 – 95');
  });

  it('recomputes the formatted output when the format option changes', () => {
    function formatValue(v: number, format?: Intl.NumberFormatOptions) {
      return new Intl.NumberFormat(undefined, format).format(v);
    }

    const [format, setFormat] = createSignal<Intl.NumberFormatOptions | undefined>(undefined);
    render(() => (
      <Slider.Root defaultValue={40} format={format()}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    expect(screen.getByTestId('output').textContent).toBe(formatValue(40));

    setFormat({ style: 'currency', currency: 'USD' });
    flush();

    expect(screen.getByTestId('output').textContent).toBe(
      formatValue(40, { style: 'currency', currency: 'USD' }),
    );
  });

  describe('prop: children', () => {
    it('accepts a render function', () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      const renderSpy = vi.fn((formatted: readonly string[], _values: readonly number[]) =>
        formatted.join(' to '),
      );
      render(() => (
        <Slider.Root defaultValue={[40, 60]} format={format}>
          <Slider.Value data-testid="output">{renderSpy}</Slider.Value>
        </Slider.Root>
      ));

      expect(renderSpy.mock.lastCall?.[0]).toEqual([formatValue(40), formatValue(60)]);
      expect(renderSpy.mock.lastCall?.[1]).toEqual([40, 60]);
      expect(screen.getByTestId('output')).toHaveTextContent(
        `${formatValue(40)} to ${formatValue(60)}`,
      );
    });
  });

  // Skipped: server-side rendering / hydration locale tests (no SSR in this test setup).
});
