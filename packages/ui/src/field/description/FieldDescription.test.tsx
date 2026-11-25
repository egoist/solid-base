import { createSignal, flush, Show } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Field } from '..';

describe('<Field.Description />', () => {
  it('renders a paragraph and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Field.Root>
        <Field.Description
          data-testid="description"
          class={(state) => (state.disabled ? 'disabled' : 'enabled')}
          style={{ color: 'red' }}
          ref={(el) => {
            ref = el;
          }}
        >
          Message
        </Field.Description>
      </Field.Root>
    ));
    const description = screen.getByTestId('description');
    expect(description.tagName).toBe('P');
    expect(description).toHaveClass('enabled');
    expect(description).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(ref).toBe(description);
  });

  it('should set aria-describedby on the control automatically', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('removes the id from aria-describedby when unmounted', () => {
    const [shown, setShown] = createSignal(true);
    render(() => (
      <Field.Root>
        <Field.Control />
        <Show when={shown()}>
          <Field.Description>Message</Field.Description>
        </Show>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby');
    setShown(false);
    flush();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('should preserve user aria-describedby values on the control', () => {
    render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(
      `external-description ${screen.getByText('Message').id}`,
    );
  });

  it('does not register an empty description id', () => {
    render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description id="">Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'external-description');
  });

  it('reflects the disabled state from Field.Item', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Description data-testid="description">Message</Field.Description>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('description')).toHaveAttribute('data-disabled');
  });
});
