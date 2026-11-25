import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '..';
import { DirectionProvider, type TextDirection } from '../../direction-provider';
import type { Orientation } from '../../internals/types';
import { useToolbarRootContext } from './ToolbarRootContext';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function settle() {
  await tick();
  flush();
}

describe('<Toolbar.Root />', () => {
  it('conformance: forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Toolbar.Root
        ref={(el) => {
          ref = el;
        }}
        class={(state) => `orientation-${state.orientation}`}
        style={{ color: 'red' }}
        render={(props) => <section {...props} />}
      />
    ));
    const toolbar = screen.getByRole('toolbar');
    expect(ref).toBe(toolbar);
    expect(toolbar.tagName).toBe('SECTION');
    expect(toolbar).toHaveClass('orientation-horizontal');
    expect(toolbar).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  describe('ARIA attributes', () => {
    it('has role="toolbar"', () => {
      const { container } = render(() => <Toolbar.Root />);
      const toolbar = container.firstElementChild as HTMLElement;
      expect(toolbar).toHaveAttribute('role', 'toolbar');
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
      expect(toolbar).toHaveAttribute('data-orientation', 'horizontal');
    });
  });

  describe('context', () => {
    function OptionalToolbarConsumer() {
      const context = useToolbarRootContext(true);
      return <span>{context?.orientation ?? 'outside'}</span>;
    }

    it('allows optional consumers both outside and inside a toolbar', () => {
      render(() => (
        <div>
          <OptionalToolbarConsumer />
          <Toolbar.Root orientation="vertical">
            <OptionalToolbarConsumer />
          </Toolbar.Root>
        </div>
      ));

      expect(screen.getByText('outside')).toBeVisible();
      expect(screen.getByText('vertical')).toBeVisible();
    });
  });

  describe('keyboard navigation', () => {
    it.each<{
      direction: TextDirection;
      orientation: Orientation;
      nextKey: string;
      prevKey: string;
    }>([
      { direction: 'ltr', orientation: 'horizontal', nextKey: 'ArrowRight', prevKey: 'ArrowLeft' },
      { direction: 'ltr', orientation: 'vertical', nextKey: 'ArrowDown', prevKey: 'ArrowUp' },
      { direction: 'rtl', orientation: 'horizontal', nextKey: 'ArrowLeft', prevKey: 'ArrowRight' },
      { direction: 'rtl', orientation: 'vertical', nextKey: 'ArrowDown', prevKey: 'ArrowUp' },
    ])(
      '$direction, orientation: $orientation',
      async ({ direction, orientation, nextKey, prevKey }) => {
        const user = userEvent.setup();
        render(() => (
          <DirectionProvider direction={direction}>
            <Toolbar.Root dir={direction} orientation={orientation}>
              <Toolbar.Button />
              <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
              <Toolbar.Group>
                <Toolbar.Button />
                <Toolbar.Button />
              </Toolbar.Group>
              <Toolbar.Input value="" />
            </Toolbar.Root>
          </DirectionProvider>
        ));
        await settle();

        const [button1, groupedButton1, groupedButton2] = screen.getAllByRole('button');
        const link = screen.getByText('Link');
        const input = screen.getByRole('textbox');

        const press = async (key: string) => {
          await user.keyboard(`[${key}]`);
          await settle();
        };

        await press('Tab');
        expect(button1).toHaveFocus();

        await press(nextKey);
        expect(link).toHaveFocus();

        await press(nextKey);
        expect(groupedButton1).toHaveFocus();

        await press(nextKey);
        expect(groupedButton2).toHaveFocus();

        await press(nextKey);
        expect(input).toHaveFocus();

        // loop to the beginning
        await press(nextKey);
        expect(button1).toHaveFocus();

        await press(prevKey);
        expect(input).toHaveFocus();

        await press(prevKey);
        expect(groupedButton2).toHaveFocus();
      },
    );

    it('does not wrap focus when loopFocus is false', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root loopFocus={false}>
          <Toolbar.Button data-testid="first" />
          <Toolbar.Button data-testid="last" />
        </Toolbar.Root>
      ));
      await settle();
      const first = screen.getByTestId('first');
      const last = screen.getByTestId('last');

      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(first).toHaveFocus();

      await press('ArrowLeft');
      expect(first).toHaveFocus();

      await press('ArrowRight');
      expect(last).toHaveFocus();

      await press('ArrowRight');
      expect(last).toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links', () => {
      render(() => (
        <Toolbar.Root disabled>
          <Toolbar.Button />
          <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
          <Toolbar.Input value="" />
          <Toolbar.Group>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input value="" />
          </Toolbar.Group>
        </Toolbar.Root>
      ));

      [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox')].forEach(
        (toolbarItem) => {
          expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
          expect(toolbarItem).toHaveAttribute('data-disabled');
        },
      );

      expect(screen.getByRole('toolbar')).toHaveAttribute('data-disabled');
      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');

      screen.getAllByText('Link').forEach((link) => {
        expect(link).not.toHaveAttribute('data-disabled');
        expect(link).not.toHaveAttribute('aria-disabled');
      });
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    function expectFocusedWhenDisabled(element: Element) {
      expect(element).toHaveAttribute('data-disabled');
      expect(element).toHaveAttribute('aria-disabled', 'true');
      expect(element).toHaveFocus();
    }

    it('toolbar items can be focused when disabled by default', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled />
          </Toolbar.Group>
          <Toolbar.Input value="" disabled />
        </Toolbar.Root>
      ));
      await settle();

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      [input, ...buttons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;
      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(button1).toHaveFocus();

      await press('ArrowRight');
      expectFocusedWhenDisabled(groupedButton1);

      await press('ArrowRight');
      expectFocusedWhenDisabled(groupedButton2);

      await press('ArrowRight');
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      await press('ArrowRight');
      expect(button1).toHaveAttribute('tabindex', '0');

      await press('ArrowLeft');
      expectFocusedWhenDisabled(input);

      await press('ArrowLeft');
      expectFocusedWhenDisabled(groupedButton2);
    });

    it('toolbar items can individually disable focusableWhenDisabled', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled focusableWhenDisabled={false} />
          </Toolbar.Group>
          <Toolbar.Input value="" disabled />
        </Toolbar.Root>
      ));
      await settle();

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      const focusableWhenDisabledButtons = buttons.filter(
        (button) => button.getAttribute('data-focusable') != null,
      );
      [input, ...focusableWhenDisabledButtons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;
      expect(groupedButton2).toHaveAttribute('disabled');

      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(button1).toHaveFocus();

      await press('ArrowRight');
      expectFocusedWhenDisabled(groupedButton1);

      await press('ArrowRight');
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      await press('ArrowRight');
      expect(button1).toHaveAttribute('tabindex', '0');

      await press('ArrowLeft');
      expectFocusedWhenDisabled(input);

      await press('ArrowLeft');
      expectFocusedWhenDisabled(groupedButton1);
    });

    it('moves the initial tab stop off a disabled, non-focusable first item', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await settle();

      const [button1, button2, button3] = screen.getAllByRole('button');
      // a natively disabled first item cannot hold the single roving tab stop
      expect(button1).toHaveAttribute('disabled');
      expect(button1).not.toHaveAttribute('tabindex', '0');
      expect(button2).toHaveAttribute('tabindex', '0');

      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(button2).toHaveFocus();

      await press('ArrowRight');
      expect(button3).toHaveFocus();

      // looping back skips the disabled first item
      await press('ArrowRight');
      expect(button2).toHaveFocus();
    });

    it('keeps an enabled item with focusableWhenDisabled={false} navigable', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Button focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await settle();

      const [button1, button2, button3] = screen.getAllByRole('button');
      expect(button2).not.toHaveAttribute('disabled');

      const press = async (key: string) => {
        await user.keyboard(`[${key}]`);
        await settle();
      };

      await press('Tab');
      expect(button1).toHaveFocus();

      await press('ArrowRight');
      expect(button2).toHaveFocus();

      await press('ArrowRight');
      expect(button3).toHaveFocus();
    });

    it('skips a disabled Toolbar.Input with focusableWhenDisabled={false}', async () => {
      const user = userEvent.setup();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Input value="" disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await settle();

      const [button1, button2] = screen.getAllByRole('button');
      const input = screen.getByRole('textbox');

      await user.keyboard('[Tab]');
      await settle();
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      await settle();
      expect(input).not.toHaveFocus();
      expect(button2).toHaveFocus();
    });
  });
});
