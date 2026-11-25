import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Button } from '.';

describe('<Button />', () => {
  it('renders a native button with type="button"', () => {
    render(() => <Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('custom element: applies button semantics and dispatches clicks from keyboard', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const handleAncestorClick = vi.fn();

    render(() => (
      <div onClick={handleAncestorClick}>
        <Button nativeButton={false} render="span" onClick={handleClick}>
          Save
        </Button>
      </div>
    ));

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('SPAN');
    expect(button).toHaveAttribute('role', 'button');
    expect(button).toHaveAttribute('tabindex', '0');

    await user.keyboard('[Tab]');
    expect(button).toHaveFocus();

    await user.keyboard('[Enter]');
    await user.keyboard('[Space]');

    expect(handleClick).toHaveBeenCalledTimes(2);
    expect(handleAncestorClick).toHaveBeenCalledTimes(2);
  });

  describe('prop: disabled', () => {
    it('native button: uses the disabled attribute', () => {
      const handleClick = vi.fn();
      render(() => (
        <Button disabled onClick={handleClick}>
          Save
        </Button>
      ));
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).not.toHaveAttribute('aria-disabled');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('custom element: uses aria-disabled and blocks handlers', () => {
      const handleClick = vi.fn();
      render(() => (
        <Button disabled nativeButton={false} render="span" onClick={handleClick}>
          Save
        </Button>
      ));
      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '-1');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('updates reactively', () => {
      const [disabled, setDisabled] = createSignal(false);
      render(() => <Button disabled={disabled()}>Save</Button>);
      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('disabled');
      setDisabled(true);
      flush();
      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('keeps a native button focusable', async () => {
      const handleClick = vi.fn();
      render(() => (
        <Button disabled focusableWhenDisabled onClick={handleClick}>
          Save
        </Button>
      ));
      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '0');
      await userEvent.setup().keyboard('[Tab]');
      expect(button).toHaveFocus();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  it('passes the state to class and render callbacks', () => {
    render(() => (
      <Button
        disabled
        class={(state) => (state.disabled ? 'is-disabled' : undefined)}
        render={(props, state) => (
          <button {...props} data-state-disabled={String(state.disabled)} />
        )}
      />
    ));
    const button = screen.getByRole('button');
    expect(button).toHaveClass('is-disabled');
    expect(button).toHaveAttribute('data-state-disabled', 'true');
  });
});
