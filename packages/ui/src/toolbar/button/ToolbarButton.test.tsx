import { createSignal, flush } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '..';
import { Toggle } from '../../toggle';
import { ToggleGroup } from '../../toggle-group';
import { ToolbarRootContext, type ToolbarRootContextValue } from '../root/ToolbarRootContext';
import {
  CompositeRootContext,
  type CompositeRootContextValue,
} from '../../internals/composite/root/CompositeRootContext';
import { NOOP } from '../../internals/noop';

const testCompositeContext: CompositeRootContextValue = {
  highlightedIndex: () => 0,
  onHighlightedIndexChange: NOOP,
  highlightItemOnHover: () => false,
  relayKeyboardEvent: NOOP,
};

const testToolbarContext: ToolbarRootContextValue = {
  disabled: false,
  orientation: 'horizontal',
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function settle() {
  await tick();
  flush();
}

describe('<Toolbar.Button />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <ToolbarRootContext value={testToolbarContext}>
        <CompositeRootContext value={testCompositeContext}>
          <Toolbar.Button
            ref={(el) => {
              ref = el;
            }}
            class={(state) => `orientation-${state.orientation}`}
            style={{ color: 'red' }}
            render={(props) => <button {...props} data-custom="" />}
          />
        </CompositeRootContext>
      </ToolbarRootContext>
    ));
    const button = screen.getByRole('button');
    expect(ref).toBe(button);
    expect(button).toHaveAttribute('data-custom');
    expect(button).toHaveClass('orientation-horizontal');
    expect(button).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(button).toHaveAttribute('data-focusable');
    expect(button).toHaveAttribute('data-orientation', 'horizontal');
  });

  describe('prop: nativeButton', () => {
    it.each(['Space', 'Enter'])(
      'custom element: dispatches real clicks from %s keyboard activation',
      async (key) => {
        const user = userEvent.setup();
        const handleClick = vi.fn();
        const handleRenderClick = vi.fn();
        const handleAncestorClick = vi.fn();

        render(() => (
          <div onClick={handleAncestorClick}>
            <Toolbar.Root>
              <Toolbar.Button
                nativeButton={false}
                render={(props) => (
                  <span
                    {...props}
                    onClick={(event) => {
                      handleRenderClick();
                      (props.onClick as (event: MouseEvent) => void)?.(event);
                    }}
                  />
                )}
                onClick={handleClick}
              >
                Save
              </Toolbar.Button>
            </Toolbar.Root>
          </div>
        ));
        await settle();

        const button = screen.getByRole('button', { name: 'Save' });

        await user.keyboard('[Tab]');
        expect(button).toHaveFocus();

        await user.keyboard(`[${key}]`);

        expect(handleRenderClick).toHaveBeenCalledTimes(1);
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handleAncestorClick).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      render(() => (
        <Toolbar.Root>
          <Toolbar.Button
            disabled
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
          />
        </Toolbar.Root>
      ));

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');

      await user.click(button);
      await user.keyboard(`[Space]`);
      await user.keyboard(`[Enter]`);
      expect(handleClick).toHaveBeenCalledTimes(0);
      expect(handleMouseDown).toHaveBeenCalledTimes(0);
      expect(handlePointerDown).toHaveBeenCalledTimes(0);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
    });

    it('uses the disabled attribute when focusableWhenDisabled is false', () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
        </Toolbar.Root>
      ));

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).not.toHaveAttribute('aria-disabled');
    });

    it('allows hover handlers while blocking activation', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const handleMouseMove = vi.fn();

      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled onClick={handleClick} onMouseMove={handleMouseMove} />
        </Toolbar.Root>
      ));

      const button = screen.getByRole('button');

      await user.hover(button);
      expect(handleMouseMove).toHaveBeenCalled();

      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(0);
    });
  });

  // The upstream tests rendering Switch, Menu, Select, Dialog, AlertDialog and Popover triggers
  // are omitted: those components are ported separately.

  describe('rendering Toggle and ToggleGroup', () => {
    it('renders toggle and toggle group', () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button render={(props) => <Toggle {...props} />} value="apple" />
          <ToggleGroup>
            <Toolbar.Button render={(props) => <Toggle {...props} />} value="one" />
            <Toolbar.Button render={(props) => <Toggle {...props} />} value="two" />
          </ToggleGroup>
        </Toolbar.Root>
      ));

      expect(screen.getAllByRole('button').length).toBe(3);
      screen.getAllByRole('button').forEach((button) => {
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('handles interactions', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button
            render={(props) => <Toggle {...props} onPressedChange={onPressedChange} />}
            value="apple"
          />
          <ToggleGroup>
            <Toolbar.Button
              render={(props) => <Toggle {...props} onPressedChange={onPressedChange} />}
              value="one"
            />
            <Toolbar.Button
              render={(props) => <Toggle {...props} onPressedChange={onPressedChange} />}
              value="two"
            />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();

      const [button1, button2, button3] = screen.getAllByRole('button');

      [button1, button2, button3].forEach((button) => {
        expect(button).toHaveAttribute('aria-pressed', 'false');
      });
      expect(onPressedChange).toHaveBeenCalledTimes(0);

      await user.keyboard('[Tab]');
      await waitFor(() => expect(button1).toHaveFocus());

      await user.keyboard('[Enter]');
      expect(onPressedChange).toHaveBeenCalledTimes(1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(button2).toHaveFocus());

      await user.keyboard('[Space]');
      expect(onPressedChange).toHaveBeenCalledTimes(2);
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(button3).toHaveFocus());

      await user.keyboard('[Enter]');
      expect(onPressedChange).toHaveBeenCalledTimes(3);
      expect(button3).toHaveAttribute('aria-pressed', 'true');
    });

    it('disabled state', async () => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button
            disabled
            render={(props) => <Toggle {...props} onPressedChange={onPressedChange} />}
            value="apple"
          />
          <ToggleGroup>
            <Toolbar.Button
              disabled
              render={(props) => <Toggle {...props} onPressedChange={onPressedChange} />}
              value="one"
            />
            <Toolbar.Button
              disabled
              render={(props) => <Toggle {...props} onPressedChange={onPressedChange} />}
              value="two"
            />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();
      const [button1, button2, button3] = screen.getAllByRole('button');

      [button1, button2, button3].forEach((button) => {
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).not.toHaveAttribute('disabled');
        expect(button).toHaveAttribute('data-disabled');
        expect(button).toHaveAttribute('aria-disabled', 'true');
      });
      expect(onPressedChange).toHaveBeenCalledTimes(0);

      await user.keyboard('[Tab]');
      await waitFor(() => expect(button1).toHaveFocus());
      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');
      expect(onPressedChange).toHaveBeenCalledTimes(0);

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(button2).toHaveFocus());
      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');
      expect(onPressedChange).toHaveBeenCalledTimes(0);

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(button3).toHaveFocus());
      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');
      expect(onPressedChange).toHaveBeenCalledTimes(0);
    });

    it('navigates and selects direct ToggleGroup > Toggle children', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(() => (
        <Toolbar.Root>
          <ToggleGroup defaultValue={['one']} onValueChange={onValueChange}>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" />
            <Toggle value="three" data-testid="three" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();

      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');
      const three = screen.getByTestId('three');

      expect(one).toHaveAttribute('aria-pressed', 'true');

      await user.keyboard('[Tab]');
      await waitFor(() => expect(one).toHaveFocus());

      // toggles past the first must be reachable (previously treated as disabled)
      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(two).toHaveFocus());

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(three).toHaveFocus());

      await user.keyboard('[Enter]');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      // exclusive selection replaces the previous value
      expect(onValueChange.mock.calls[0][0]).toEqual(['three']);
      expect(one).toHaveAttribute('aria-pressed', 'false');
      expect(three).toHaveAttribute('aria-pressed', 'true');
    });

    it('skips disabled direct ToggleGroup > Toggle children', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <ToggleGroup>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" disabled />
            <Toggle value="three" data-testid="three" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();

      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');
      const three = screen.getByTestId('three');

      expect(two).toBeDisabled();

      await user.keyboard('[Tab]');
      await waitFor(() => expect(one).toHaveFocus());

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(three).toHaveFocus());
      expect(two).not.toHaveAttribute('tabindex', '0');
    });

    it('supports multiple selection for direct ToggleGroup > Toggle children', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(() => (
        <Toolbar.Root>
          <ToggleGroup multiple defaultValue={['one']} onValueChange={onValueChange}>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();

      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');

      await user.keyboard('[Tab]');
      await waitFor(() => expect(one).toHaveFocus());

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(two).toHaveFocus());

      await user.keyboard('[Enter]');
      expect(onValueChange.mock.calls[0][0]).toEqual(['one', 'two']);
      expect(one).toHaveAttribute('aria-pressed', 'true');
      expect(two).toHaveAttribute('aria-pressed', 'true');
    });

    it('supports a controlled ToggleGroup value', async () => {
      const user = userEvent.setup();
      const [value, setValue] = createSignal<string[]>([]);
      render(() => (
        <Toolbar.Root>
          <ToggleGroup value={value()} onValueChange={setValue}>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();
      const one = screen.getByTestId('one');

      expect(one).toHaveAttribute('aria-pressed', 'false');

      await user.keyboard('[Tab]');
      await waitFor(() => expect(one).toHaveFocus());

      await user.keyboard('[Enter]');
      flush();
      expect(one).toHaveAttribute('aria-pressed', 'true');
    });

    it('disables direct ToggleGroup children when Toolbar.Group is disabled', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button data-testid="before" />
          <Toolbar.Group disabled>
            <ToggleGroup>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" />
            </ToggleGroup>
          </Toolbar.Group>
          <Toolbar.Button data-testid="after" />
        </Toolbar.Root>
      ));
      await settle();

      const before = screen.getByTestId('before');
      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');
      const after = screen.getByTestId('after');

      [one, two].forEach((toggle) => {
        expect(toggle).toBeDisabled();
        expect(toggle).toHaveAttribute('data-disabled');
      });

      await user.keyboard('[Tab]');
      await waitFor(() => expect(before).toHaveFocus());

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(after).toHaveFocus());
      expect(one).not.toHaveAttribute('tabindex', '0');
      expect(two).not.toHaveAttribute('tabindex', '0');
    });

    it('skips a direct Toggle that becomes disabled at runtime', async () => {
      const user = userEvent.setup();
      const [twoDisabled, setTwoDisabled] = createSignal(false);
      render(() => (
        <Toolbar.Root>
          <ToggleGroup>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" disabled={twoDisabled()} />
            <Toggle value="three" data-testid="three" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await settle();

      const one = screen.getByTestId('one');
      const three = screen.getByTestId('three');

      await user.keyboard('[Tab]');
      await waitFor(() => expect(one).toHaveFocus());

      setTwoDisabled(true);
      await settle();

      await user.keyboard('[ArrowRight]');
      await waitFor(() => expect(three).toHaveFocus());
    });
  });
});
