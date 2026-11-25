import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Toggle } from '.';
import { ToggleGroup } from '../toggle-group';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('<Toggle />', () => {
  describe('conformance', () => {
    it('forwards ref, class, style and supports render', () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Toggle
          ref={(el) => {
            ref = el;
          }}
          class={(state) => (state.pressed ? 'pressed' : 'unpressed')}
          style={{ color: 'red' }}
          render={(props, state) => <button {...props} data-state-pressed={String(state.pressed)} />}
        />
      ));
      const button = screen.getByRole('button');
      expect(ref).toBe(button);
      expect(button).toHaveClass('unpressed');
      expect(button).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      expect(button).toHaveAttribute('data-state-pressed', 'false');
    });
  });

  describe('pressed state', () => {
    it('controlled', () => {
      const [pressed, setPressed] = createSignal(false);
      render(() => (
        <div>
          <input type="checkbox" checked={pressed()} onChange={() => setPressed(!pressed())} />
          <Toggle pressed={pressed()} />
        </div>
      ));
      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-pressed', 'false');
      checkbox.click();
      flush();
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('data-pressed');

      checkbox.click();
      flush();
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).not.toHaveAttribute('data-pressed');
    });

    it('uncontrolled', () => {
      render(() => <Toggle defaultPressed={false} />);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-pressed', 'false');
      button.click();
      flush();
      expect(button).toHaveAttribute('aria-pressed', 'true');

      button.click();
      flush();
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: onPressedChange', () => {
    it('is called when the pressed state changes', () => {
      const handlePressed = vi.fn();
      render(() => <Toggle defaultPressed={false} onPressedChange={handlePressed} />);
      const button = screen.getByRole('button');

      button.click();
      flush();

      expect(handlePressed.mock.calls.length).toBe(1);
      expect(handlePressed.mock.calls[0][0]).toBe(true);
      expect(handlePressed.mock.calls[0][1].reason).toBe('none');
      expect(handlePressed.mock.calls[0][1].event).toBeInstanceOf(MouseEvent);
    });

    it('does not change the pressed state when the event is canceled', () => {
      render(() => (
        <Toggle
          defaultPressed={false}
          onPressedChange={(_pressed, eventDetails) => {
            eventDetails.cancel();
          }}
        />
      ));
      const button = screen.getByRole('button');
      button.click();
      flush();
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('canceling in a grouped Toggle prevents the group value from changing', () => {
      const onValueChange = vi.fn();
      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle
            value="one"
            onPressedChange={(_pressed, eventDetails) => {
              eventDetails.cancel();
            }}
          />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      const [button1] = screen.getAllByRole('button');
      button1.click();
      flush();
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(onValueChange.mock.calls.length).toBe(0);
    });
  });

  describe('prop: disabled', () => {
    it('disables the component', () => {
      const handlePressed = vi.fn();
      render(() => <Toggle disabled onPressedChange={handlePressed} />);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-pressed', 'false');

      button.click();
      flush();

      expect(handlePressed.mock.calls.length).toBe(0);
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: render', () => {
    it('should pass composite props', async () => {
      const renderSpy = vi.fn();
      render(() => (
        <ToggleGroup defaultValue={['left']}>
          <Toggle
            value="left"
            render={(props) => {
              renderSpy(props);
              return <button {...props} />;
            }}
          />
        </ToggleGroup>
      ));
      await tick();
      flush();
      // `render` is called once with live props.
      expect(renderSpy.mock.lastCall?.[0].tabindex).toBe(0);
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
    });
  });
});
