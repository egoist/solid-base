import { render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { flushMicrotasks } from '../test-utils';

describe('<Combobox.Label />', () => {
  it('forwards ref, class, style and render, and labels the trigger', async () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Combobox.Root>
        <Combobox.Label
          data-testid="label"
          ref={(el) => {
            ref = el;
          }}
          class="label"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        >
          Fruit
        </Combobox.Label>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    await flushMicrotasks();

    const label = screen.getByTestId('label');
    expect(ref).toBe(label);
    expect(label.tagName).toBe('SECTION');
    expect(label).toHaveClass('label');
    expect(label).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('warns when labeling an external input', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Combobox.Root>
          <Combobox.Label>Fruit</Combobox.Label>
          <Combobox.Input />
        </Combobox.Root>
      ));
      await flushMicrotasks();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('<Combobox.Label> labels <Combobox.Trigger> only.'),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  // Upstream toggles `process.env.NODE_ENV` at runtime; Solid's `isDev` is resolved at build time.
  it.skip('does not run the development warning in production', () => {});
});
