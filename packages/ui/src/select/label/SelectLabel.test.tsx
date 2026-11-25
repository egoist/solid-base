import { render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { Select } from '..';

describe('<Select.Label />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root>
        <Select.Label
          data-testid="label"
          ref={(el) => {
            ref = el;
          }}
          class="label"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        >
          Fruit
        </Select.Label>
        <Select.Trigger data-testid="trigger" />
        <Select.Portal>
          <Select.Positioner />
        </Select.Portal>
      </Select.Root>
    ));
    flush();
    const label = screen.getByTestId('label');
    expect(ref).toBe(label);
    expect(label.tagName).toBe('SECTION');
    expect(label).toHaveClass('label');
    expect(label).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('labels the trigger and focuses it on click', () => {
    render(() => (
      <Select.Root>
        <Select.Label data-testid="label">Fruit</Select.Label>
        <Select.Trigger data-testid="trigger" />
      </Select.Root>
    ));
    flush();
    const label = screen.getByTestId('label');
    const trigger = screen.getByTestId('trigger');
    expect(label).toBeInstanceOf(window.HTMLDivElement);
    expect(label.id).not.toBe('');
    expect(trigger).toHaveAttribute('aria-labelledby', label.id);
    expect(trigger).toHaveAccessibleName('Fruit');

    label.click();
    flush();
    expect(trigger).toHaveFocus();
  });
});
