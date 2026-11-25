import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Field } from '..';
import { Form } from '../../form';

function change(element: HTMLElement, value: string) {
  fireEvent.input(element, { target: { value } });
  flush();
}

function click(element: HTMLElement) {
  fireEvent.click(element);
  flush();
}

describe('<Field.Error />', () => {
  it('renders a div and supports class, style, render and ref', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Field.Root invalid>
        <Field.Error
          match
          data-testid="error"
          class="error"
          style={{ color: 'red' }}
          render={(props) => <div {...props} data-custom="" />}
          ref={(el) => {
            ref = el;
          }}
        />
      </Field.Root>
    ));
    const error = screen.getByTestId('error');
    expect(error.tagName).toBe('DIV');
    expect(error).toHaveClass('error');
    expect(error).toHaveAttribute('data-custom');
    expect(error).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(error).toHaveAttribute('data-invalid');
    expect(ref).toBe(error);
  });

  it('should set aria-describedby on the control automatically', () => {
    render(() => (
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match>Message</Field.Error>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('should show error messages by default', () => {
    render(() => (
      <Form>
        <Field.Root>
          <Field.Control required />
          <Field.Error>Message</Field.Error>
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    expect(screen.queryByText('Message')).toBe(null);

    const input = screen.getByRole<HTMLInputElement>('textbox');

    fireEvent.focus(input);
    change(input, 'a');
    change(input, '');
    fireEvent.blur(input);
    flush();
    expect(screen.queryByText('Message')).toBe(null);

    click(screen.getByText('submit'));
    expect(screen.queryByText('Message')).not.toBe(null);
  });

  describe('prop: match', () => {
    it('should only render when `match` matches constraint validation', () => {
      render(() => (
        <Form>
          <Field.Root>
            <Field.Control required minlength={2} />
            <Field.Error match="valueMissing">Message</Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      expect(screen.queryByText('Message')).toBe(null);

      click(screen.getByText('submit'));
      expect(screen.queryByText('Message')).not.toBe(null);

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      change(input, 'a');
      expect(screen.queryByText('Message')).toBe(null);

      change(input, '');
      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('should show custom errors', () => {
      render(() => (
        <Form>
          <Field.Root validate={() => 'error'}>
            <Field.Control />
            <Field.Error match="customError">Message</Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      change(input, 'a');
      fireEvent.blur(input);
      flush();
      expect(screen.queryByText('Message')).toBe(null);

      click(screen.getByText('submit'));
      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('uses `match={false}` as the default slot for Form errors', () => {
      render(() => (
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" required minlength={8} pattern="[a-z]+" />
            <Field.Error match="valueMissing">Username is required.</Field.Error>
            <Field.Error match="tooShort">Username must be at least 8 characters.</Field.Error>
            <Field.Error match="patternMismatch">
              Username can only include lowercase letters.
            </Field.Error>
            <Field.Error data-testid="default-error" match={false} />
          </Field.Root>
        </Form>
      ));

      expect(screen.queryByText('Username is required.')).toBe(null);
      expect(screen.queryByText('Username must be at least 8 characters.')).toBe(null);
      expect(screen.queryByText('Username can only include lowercase letters.')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('uses an omitted `match` as the default slot for Form errors', () => {
      render(() => (
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" required minlength={8} pattern="[a-z]+" />
            <Field.Error match="valueMissing">Username is required.</Field.Error>
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.queryByText('Username is required.')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('uses the Field.Control name fallback for Form errors', () => {
      render(() => (
        <Form errors={{ email: 'Email is already taken' }}>
          <Field.Root>
            <Field.Control name="email" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>
      ));

      const control = screen.getByRole('textbox');

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Email is already taken');

      change(control, 'next@example.com');

      expect(control).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);
    });

    it('ignores inherited Form error properties', () => {
      render(() => (
        <Form errors={{}}>
          <Field.Root name="constructor">
            <Field.Control />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);
    });

    it('renders Form error arrays as a list', () => {
      render(() => (
        <Form errors={{ username: ['Username is reserved', 'Username is too short'] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>
      ));

      const list = screen.getByTestId('default-error').querySelector('ul');
      expect(list).not.toBe(null);
      expect(list?.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('Username is reserved')).not.toBe(null);
      expect(screen.getByText('Username is too short')).not.toBe(null);
    });

    it('renders single-item Form error arrays as text', () => {
      render(() => (
        <Form errors={{ username: ['Username is reserved'] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.getByTestId('default-error').querySelector('ul')).toBe(null);
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('renders client validation error arrays as a list', () => {
      render(() => (
        <Form>
          <Field.Root validate={() => ['First error', 'Second error']}>
            <Field.Control />
            <Field.Error data-testid="default-error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      click(screen.getByText('submit'));

      const list = screen.getByTestId('default-error').querySelector('ul');
      expect(list).not.toBe(null);
      expect(list?.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getByText('First error')).not.toBe(null);
      expect(screen.getByText('Second error')).not.toBe(null);
    });

    it('does not register an empty error id', () => {
      render(() => (
        <Field.Root invalid>
          <Field.Control aria-describedby="external-description" />
          <Field.Error id="">Message</Field.Error>
        </Field.Root>
      ));

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        'external-description',
      );
    });

    it('ignores empty Form error arrays', () => {
      render(() => (
        <Form errors={{ username: [] }}>
          <Field.Root name="username">
            <Field.Control defaultValue="admin" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.queryByTestId('default-error')).toBe(null);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    });

    it('uses `match={false}` as the default slot for client validation errors', () => {
      render(() => (
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Error data-testid="default-error" match={false} />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      expect(screen.queryByTestId('default-error')).toBe(null);

      click(screen.getByText('submit'));

      expect(screen.getByTestId('default-error')).not.toBe(null);
    });

    it('uses the client validation path for specific matches when Form errors are present', () => {
      render(() => (
        <Form errors={{ username: 'Username is reserved' }}>
          <Field.Root name="username" validate={() => 'Client validation error'}>
            <Field.Control />
            <Field.Error data-testid="custom-error" match="customError" />
            <Field.Error data-testid="default-error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      click(screen.getByText('submit'));

      expect(screen.getByTestId('custom-error')).toHaveTextContent('Client validation error');
      expect(screen.getByTestId('custom-error')).not.toHaveTextContent('Username is reserved');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Username is reserved');
    });

    it('always renders the error message when `match` is true', () => {
      render(() => (
        <Field.Root>
          <Field.Control required />
          <Field.Error match>Message</Field.Error>
        </Field.Root>
      ));

      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('unmounts when `match` turns false (animations disabled in jsdom)', async () => {
      const [match, setMatch] = createSignal(true);
      render(() => (
        <Field.Root>
          <Field.Error match={match()} data-testid="error">
            Message
          </Field.Error>
        </Field.Root>
      ));

      expect(screen.getByTestId('error')).toBeInTheDocument();
      setMatch(false);
      flush();
      await waitFor(() => {
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });
  });

  // Skipped: upstream's animation tests (data-starting-style / data-ending-style timing) need
  // real CSS transitions and animations, which jsdom doesn't implement.
});
