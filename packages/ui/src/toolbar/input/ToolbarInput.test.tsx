import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '..';
import { DirectionProvider } from '../../direction-provider';
import type { Orientation } from '../../internals/types';
import { ToolbarRootContext, type ToolbarRootContextValue } from '../root/ToolbarRootContext';
import {
  CompositeRootContext,
  type CompositeRootContextValue,
} from '../../internals/composite/root/CompositeRootContext';
import { NOOP } from '../../internals/noop';
import {
  ARROW_UP,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
} from '../../internals/composite/composite';

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

describe('<Toolbar.Input />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <ToolbarRootContext value={testToolbarContext}>
        <CompositeRootContext value={testCompositeContext}>
          <Toolbar.Input
            ref={(el) => {
              ref = el;
            }}
            class={(state) => `orientation-${state.orientation}`}
            style={{ color: 'red' }}
            render={(props) => <input {...props} data-custom="" />}
          />
        </CompositeRootContext>
      </ToolbarRootContext>
    ));
    const input = screen.getByRole('textbox');
    expect(ref).toBe(input);
    expect(input).toHaveAttribute('data-custom');
    expect(input).toHaveClass('orientation-horizontal');
    expect(input).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(input).toHaveAttribute('data-focusable');
  });

  describe('pointer interactions', () => {
    it('does not steal focus while disabled and becomes pointer-focusable when enabled', async () => {
      const user = userEvent.setup();
      const [disabled, setDisabled] = createSignal(true);
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
          <Toolbar.Input data-testid="input" disabled={disabled()} />
        </Toolbar.Root>
      ));
      await settle();
      const button = screen.getByTestId('button');
      const input = screen.getByTestId('input');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(input);
      expect(button).toHaveFocus();

      setDisabled(false);
      flush();
      await user.click(input);
      expect(input).toHaveFocus();
    });

    it('prevents click default actions while disabled', async () => {
      const user = userEvent.setup();
      const [disabled, setDisabled] = createSignal(true);
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input type="checkbox" disabled={disabled()} />
        </Toolbar.Root>
      ));
      const input = screen.getByRole('checkbox');

      await user.click(input);
      expect(input).not.toBeChecked();

      setDisabled(false);
      flush();
      await user.click(input);
      expect(input).toBeChecked();
    });
  });

  describe('keyboard navigation', () => {
    it.each([
      ['ltr', ARROW_RIGHT, ARROW_LEFT],
      ['rtl', ARROW_LEFT, ARROW_RIGHT],
    ] as const)(
      'respects caret and selection boundaries in horizontal %s toolbars',
      async (direction, nextKey, previousKey) => {
        const user = userEvent.setup();
        render(() => (
          <DirectionProvider direction={direction}>
            <Toolbar.Root orientation="horizontal">
              <Toolbar.Button data-testid="before" />
              <Toolbar.Input value="abcd" />
              <Toolbar.Button data-testid="after" />
            </Toolbar.Root>
          </DirectionProvider>
        ));
        await settle();
        const input = screen.getByRole('textbox') as HTMLInputElement;
        const before = screen.getByTestId('before');
        const after = screen.getByTestId('after');

        const press = async (keys: string) => {
          await user.keyboard(keys);
          await settle();
        };

        await press('[Tab]');
        await press(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(1, 3);
        await press(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(2, 2);
        await press(`[ShiftLeft>][${nextKey}][/ShiftLeft]`);
        expect(input).toHaveFocus();

        const nextBoundary =
          direction === 'rtl' || nextKey === ARROW_RIGHT ? input.value.length : 0;
        input.setSelectionRange(nextBoundary, nextBoundary);
        await press(`[${nextKey}]`);
        expect(after).toHaveFocus();

        await press(`[${previousKey}]`);
        expect(input).toHaveFocus();
        const previousBoundary =
          direction === 'rtl' || previousKey === ARROW_LEFT ? 0 : input.value.length;
        input.setSelectionRange(previousBoundary, previousBoundary);
        await press(`[${previousKey}]`);
        expect(before).toHaveFocus();
      },
    );

    it.each<{ orientation: Orientation; nextKey: string; prevKey: string }>([
      { orientation: 'horizontal', nextKey: ARROW_RIGHT, prevKey: ARROW_LEFT },
      { orientation: 'vertical', nextKey: ARROW_DOWN, prevKey: ARROW_UP },
    ])('orientation: $orientation', async ({ orientation, nextKey, prevKey }) => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root orientation={orientation}>
          <Toolbar.Button />
          <Toolbar.Input value="abcd" />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await settle();
      const input = screen.getByRole('textbox') as HTMLInputElement;
      const [button1, button2] = screen.getAllByRole('button');

      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(button1).toHaveFocus();

      await press(nextKey);
      expect(input).toHaveFocus();

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      await press(ARROW_RIGHT);
      await press(nextKey);
      expect(button2).toHaveFocus();

      await press(prevKey);
      expect(input).toHaveFocus();

      await press(ARROW_LEFT);
      await press(prevKey);
      expect(button1).toHaveFocus();
    });
  });

  describe('disabled', () => {
    it('does not trap keyboard focus when disabled', async () => {
      const user = userEvent.setup();
      render(() => (
        <div>
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input value="abcd" disabled />
          </Toolbar.Root>
          <button type="button" data-testid="after">
            after
          </button>
        </div>
      ));
      await settle();

      const button = screen.getByTestId('button');
      const input = screen.getByRole('textbox');
      const after = screen.getByTestId('after');

      const press = async (keys: string) => {
        await user.keyboard(keys);
        await settle();
      };

      await press('[Tab]');
      expect(button).toHaveFocus();

      await press(`[${ARROW_RIGHT}]`);
      expect(input).toHaveFocus();

      // Tab must leave the toolbar instead of being trapped on the disabled input
      await press('[Tab]');
      expect(after).toHaveFocus();

      await press('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(input).toHaveFocus();
    });

    it('does not block vertical roving focus when disabled', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button data-testid="button1" />
          <Toolbar.Input value="abcd" disabled />
          <Toolbar.Button data-testid="button2" />
        </Toolbar.Root>
      ));
      await settle();

      const input = screen.getByRole('textbox');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(button1).toHaveFocus();

      await press(ARROW_DOWN);
      expect(input).toHaveFocus();

      // ArrowDown must move roving focus past the disabled input
      await press(ARROW_DOWN);
      expect(button2).toHaveFocus();

      await press(ARROW_UP);
      expect(input).toHaveFocus();

      await press(ARROW_UP);
      expect(button1).toHaveFocus();
    });
  });

  // `rendering NumberField` tests are omitted: NumberField is not part of this port's scope yet.
});
