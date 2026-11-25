import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { DirectionProvider, type TextDirection } from '../direction-provider';
import { ToggleGroup } from '.';
import { Toggle } from '../toggle';
import { Toolbar } from '../toolbar';
import type { Orientation } from '../internals/types';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function settle() {
  await tick();
  flush();
}

describe('<ToggleGroup />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <ToggleGroup
        ref={(el) => {
          ref = el;
        }}
        class={(state) => `orientation-${state.orientation}`}
        style={{ color: 'red' }}
        render={(props) => <section {...props} />}
      />
    ));
    const group = screen.getByRole('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('orientation-horizontal');
    expect(group).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders a `group`', () => {
    render(() => <ToggleGroup aria-label="My Toggle Group" />);
    expect(screen.queryByRole('group', { name: 'My Toggle Group' })).not.toBe(null);
  });

  describe('uncontrolled', () => {
    it('pressed state', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('prop: defaultValue', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup defaultValue={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });

    it('when Toggles omit value', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup>
          <Toggle />
          <Toggle value="" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('should warn if Toggle value is not set and ToggleGroup value is defined', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(() => (
          <ToggleGroup defaultValue={['one']}>
            <Toggle />
            <Toggle />
          </ToggleGroup>
        ));
        flush();

        expect(spy).toHaveBeenCalledExactlyOnceWith(
          'Base UI: A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop. This will cause issues between the Toggle Group and Toggle values. Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
        );
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('controlled', () => {
    it('pressed state', () => {
      const [value, setValue] = createSignal(['two']);
      render(() => (
        <ToggleGroup value={value()}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');

      setValue(['one']);
      flush();

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      setValue(['two']);
      flush();

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not change without an external update', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(() => (
        <ToggleGroup value={['two']} onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');
      await user.click(button1);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('prop: disabled', () => {
    it('can disable the whole group', () => {
      render(() => (
        <ToggleGroup disabled>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'true');
      expect(button1).toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');
    });

    it('can disable individual items', () => {
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'false');
      expect(button1).not.toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });
  });

  describe('prop: orientation', () => {
    it('vertical', () => {
      render(() => (
        <ToggleGroup orientation="vertical">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
    });

    it('does not render aria-orientation on role="group"', () => {
      render(() => (
        <ToggleGroup orientation="horizontal">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      expect(screen.getByRole('group')).not.toHaveAttribute('aria-orientation');
    });
  });

  describe('prop: multiple', () => {
    it('sets data-multiple only when true', () => {
      const [multiple, setMultiple] = createSignal(false);
      render(() => (
        <ToggleGroup multiple={multiple()}>
          <Toggle value="one" />
        </ToggleGroup>
      ));

      const group = screen.getByRole('group');
      expect(group).not.toHaveAttribute('data-multiple');

      setMultiple(true);
      flush();
      expect(group).toHaveAttribute('data-multiple');

      setMultiple(false);
      flush();
      expect(group).not.toHaveAttribute('data-multiple');
    });

    it('multiple items can be pressed when true', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup multiple defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('only one item can be pressed when false', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('when Toggles omit value', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('prop: multiple transitions', () => {
    it.each([
      ['standalone', false],
      ['nested in Toolbar.Group', true],
    ] as const)('preserves selection and roving focus when %s', async (_label, inToolbar) => {
      const user = userEvent.setup();
      const [multiple, setMultiple] = createSignal(false);

      const group = () => (
        <ToggleGroup data-testid="toggle-group" defaultValue={['one']} multiple={multiple()}>
          <Toggle value="one">One</Toggle>
          <Toggle value="two">Two</Toggle>
        </ToggleGroup>
      );

      render(() =>
        inToolbar ? (
          <Toolbar.Root>
            <Toolbar.Group>{group()}</Toolbar.Group>
          </Toolbar.Root>
        ) : (
          group()
        ),
      );
      await settle();

      const groupElement = screen.getByTestId('toggle-group');
      const [button1, button2] = screen.getAllByRole('button');

      expect(groupElement).not.toHaveAttribute('data-multiple');
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.keyboard('[Tab][ArrowRight]');
      await settle();
      expect(button2).toHaveFocus();

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      setMultiple(true);
      flush();
      expect(groupElement).toHaveAttribute('data-multiple');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      setMultiple(false);
      flush();
      expect(groupElement).not.toHaveAttribute('data-multiple');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.keyboard('[ArrowLeft]');
      await settle();
      expect(button1).toHaveFocus();
    });
  });

  describe('keyboard interactions', () => {
    const arrowKeyCases: Array<{
      direction: TextDirection;
      orientation: Orientation;
      nextKey: string;
      prevKey: string;
      ignoredNextKey: string;
      ignoredPrevKey: string;
    }> = [
      {
        direction: 'ltr',
        orientation: 'horizontal',
        nextKey: 'ArrowRight',
        prevKey: 'ArrowLeft',
        ignoredNextKey: 'ArrowDown',
        ignoredPrevKey: 'ArrowUp',
      },
      {
        direction: 'ltr',
        orientation: 'vertical',
        nextKey: 'ArrowDown',
        prevKey: 'ArrowUp',
        ignoredNextKey: 'ArrowRight',
        ignoredPrevKey: 'ArrowLeft',
      },
      {
        direction: 'rtl',
        orientation: 'horizontal',
        nextKey: 'ArrowLeft',
        prevKey: 'ArrowRight',
        ignoredNextKey: 'ArrowDown',
        ignoredPrevKey: 'ArrowUp',
      },
      {
        direction: 'rtl',
        orientation: 'vertical',
        nextKey: 'ArrowDown',
        prevKey: 'ArrowUp',
        ignoredNextKey: 'ArrowLeft',
        ignoredPrevKey: 'ArrowRight',
      },
    ];

    it.each(arrowKeyCases)(
      '$direction, orientation: $orientation moves focus with arrow keys',
      async ({ direction, orientation, nextKey, prevKey, ignoredNextKey, ignoredPrevKey }) => {
        const user = userEvent.setup();
        render(() => (
          <DirectionProvider direction={direction}>
            <ToggleGroup orientation={orientation}>
              <Toggle value="one" />
              <Toggle value="two" />
              <Toggle value="three" />
            </ToggleGroup>
          </DirectionProvider>
        ));
        await settle();

        const [button1, button2, button3] = screen.getAllByRole('button');

        const press = async (key: string) => {
          await user.keyboard(`[${key}]`);
          await settle();
        };

        await press('Tab');
        expect(button1).toHaveAttribute('tabindex', '0');
        expect(button1).toHaveFocus();

        await press(nextKey);
        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();

        await press(nextKey);
        expect(button3).toHaveAttribute('tabindex', '0');
        expect(button3).toHaveFocus();

        // loop to the beginning
        await press(nextKey);
        expect(button1).toHaveAttribute('tabindex', '0');
        expect(button1).toHaveFocus();

        await press(prevKey);
        expect(button3).toHaveAttribute('tabindex', '0');
        expect(button3).toHaveFocus();

        await press(prevKey);
        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();

        // keys from the other axis should not move focus
        await press(ignoredNextKey);
        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();

        await press(ignoredPrevKey);
        expect(button2).toHaveAttribute('tabindex', '0');
        expect(button2).toHaveFocus();
      },
    );

    it('Home and End keys move focus to the first and last items', async () => {
      const user = userEvent.setup();
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      await settle();

      const [button1, button2, button3] = screen.getAllByRole('button');
      const press = async (keys: string) => {
        await user.keyboard(keys);
        await settle();
      };

      await press('[Tab]');
      expect(button1).toHaveFocus();

      await press('[End]');
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();

      await press('[ArrowLeft]');
      expect(button2).toHaveFocus();

      await press('[Home]');
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();
    });

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'key: $key toggles the pressed state',
      async ({ key }) => {
        const user = userEvent.setup();
        render(() => (
          <ToggleGroup>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        ));

        const [button1] = screen.getAllByRole('button');

        expect(button1).toHaveAttribute('aria-pressed', 'false');

        button1.focus();

        await user.keyboard(`[${key}]`);
        expect(button1).toHaveAttribute('aria-pressed', 'true');

        await user.keyboard(`[${key}]`);
        expect(button1).toHaveAttribute('aria-pressed', 'false');
      },
    );
  });

  describe('prop: onValueChange', () => {
    it('fires when an Item is clicked', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);
      expect(onValueChange.mock.calls[0][1].reason).toBe('none');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });

    it('does not change the value when the event is canceled', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1] = screen.getAllByRole('button');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it.each([{ key: 'Enter' }, { key: 'Space' }])(
      'fires when the $key is pressed',
      async ({ key }) => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();

        render(() => (
          <ToggleGroup onValueChange={onValueChange}>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        ));

        const [button1, button2] = screen.getAllByRole('button');

        button1.focus();
        await user.keyboard(`[${key}]`);

        expect(onValueChange.mock.calls.length).toBe(1);
        expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

        button2.focus();
        await user.keyboard(`[${key}]`);

        expect(onValueChange.mock.calls.length).toBe(2);
        expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
      },
    );
  });
});
