import { render, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { Select } from '..';

describe('<Select.Group />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Select.Root open>
        <Select.Group
          ref={(el) => {
            ref = el;
          }}
          class="group"
          style={{ color: 'red' }}
          render={(props) => <section {...props} />}
        />
      </Select.Root>
    ));
    const group = screen.getByRole('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('group');
    expect(group).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('should render group with label', () => {
    render(() => (
      <Select.Root open>
        <Select.Positioner>
          <Select.Group>
            <Select.GroupLabel>Fruits</Select.GroupLabel>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Group>
        </Select.Positioner>
      </Select.Root>
    ));
    flush();

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby');
    expect(screen.getByText('Fruits')).toBeVisible();
  });

  it('should associate label with group', () => {
    render(() => (
      <Select.Root open>
        <Select.Positioner>
          <Select.Group>
            <Select.GroupLabel>Vegetables</Select.GroupLabel>
            <Select.Item value="carrot">Carrot</Select.Item>
            <Select.Item value="lettuce">Lettuce</Select.Item>
          </Select.Group>
        </Select.Positioner>
      </Select.Root>
    ));
    flush();

    const group = screen.getByRole('group');
    const label = screen.getByText('Vegetables');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
  });
});
