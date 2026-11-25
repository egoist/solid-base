import { render, screen, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Portal } from '@solidjs/web';
import { Slider } from '..';
import { Field } from '../../field';

describe('<Slider.Label />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Label
          data-testid="label"
          class={(state) => `orientation-${state.orientation}`}
          style={{ color: 'red' }}
          ref={(element) => {
            ref = element;
          }}
        >
          Volume
        </Slider.Label>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('DIV');
    expect(label).toHaveClass('orientation-horizontal');
    expect(label.style.color).toBe('red');
    expect(ref).toBe(label);
  });

  it('ignores a runtime id override and derives it from the root', () => {
    render(() => (
      <Slider.Root defaultValue={50} id="slider">
        <Slider.Label data-testid="label" {...({ id: 'custom' } as object)}>
          Volume
        </Slider.Label>
      </Slider.Root>
    ));
    expect(screen.getByTestId('label')).toHaveAttribute('id', 'slider-label');
  });

  it('focuses the registered thumb when composed within a Field', async () => {
    const user = userEvent.setup();
    render(() => (
      <Field.Root>
        <Slider.Root defaultValue={50}>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <input aria-label="Unrelated range" type="range" />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>
    ));

    await user.click(screen.getByTestId('label'));

    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveFocus();
    expect(screen.getByRole('slider', { name: 'Unrelated range' })).not.toHaveFocus();
  });

  it('focuses the thumb in its shadow root when the outer document has a matching ID', async () => {
    const user = userEvent.setup();
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);
    document.body.appendChild(host);

    try {
      const { unmount } = render(() => (
        <>
          <input aria-label="Unrelated control" />
          <Portal mount={container}>
            <Field.Root>
              <Slider.Root defaultValue={50}>
                <Slider.Label>Volume</Slider.Label>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
          </Portal>
        </>
      ));

      try {
        const thumb = within(container).getByRole('slider', { name: 'Volume' });
        const unrelatedControl = screen.getByRole('textbox', { name: 'Unrelated control' });
        expect(thumb.id).not.toBe('');
        unrelatedControl.id = thumb.id;

        await user.click(within(container).getByText('Volume'));

        expect(shadowRoot.activeElement).toBe(thumb);
        expect(unrelatedControl).not.toHaveFocus();
      } finally {
        unmount();
      }
    } finally {
      host.remove();
    }
  });

  it('focuses a thumb in the light DOM from a label in a shadow root', async () => {
    const user = userEvent.setup();
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);
    document.body.appendChild(host);

    try {
      const { unmount } = render(() => (
        <Field.Root>
          <Slider.Root defaultValue={50}>
            <Portal mount={container}>
              <Slider.Label>Volume</Slider.Label>
            </Portal>
            <Slider.Control>
              <input aria-label="Unrelated range" type="range" />
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));

      try {
        await user.click(within(container).getByText('Volume'));
        expect(screen.getAllByRole('slider')[1]).toHaveFocus();
      } finally {
        unmount();
      }
    } finally {
      host.remove();
    }
  });

  it('does not throw when the label is clicked in a detached root', () => {
    const container = document.createElement('div');

    const { unmount } = render(
      () => (
        <Field.Root>
          <Slider.Root defaultValue={50}>
            <Slider.Label>Volume</Slider.Label>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ),
      { container },
    );

    const errors: ErrorEvent[] = [];
    function handleError(event: ErrorEvent) {
      event.preventDefault();
      errors.push(event);
    }
    window.addEventListener('error', handleError);

    try {
      within(container).getByText('Volume').click();
      expect(errors).toHaveLength(0);
    } finally {
      window.removeEventListener('error', handleError);
      unmount();
    }
  });

  it('does nothing when a Field slider has no thumb to focus', async () => {
    const user = userEvent.setup();
    render(() => (
      <Field.Root>
        <Slider.Root defaultValue={50}>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control />
        </Slider.Root>
      </Field.Root>
    ));

    await user.click(screen.getByTestId('label'));

    expect(document.body).toHaveFocus();
  });
});
