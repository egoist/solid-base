import { render, screen } from '@solidjs/testing-library';
import { Menu } from '..';

describe('<Menu.RadioGroup />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.RadioGroup
        ref={(el) => {
          ref = el;
        }}
        disabled
        class={(state) => (state.disabled ? 'disabled' : 'enabled')}
        style={{ color: 'red' }}
        render={(props) => <section {...props} />}
      />
    ));
    const group = screen.getByRole('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('disabled');
    expect(group).toHaveAttribute('data-disabled');
    expect(group).toHaveAttribute('aria-disabled', 'true');
    expect(group.style.color).toBe('red');
  });

  it('renders a div with the `group` role', () => {
    render(() => <Menu.RadioGroup />);
    expect(screen.getByRole('group')).toBeVisible();
    expect(screen.getByRole('group').tagName).toBe('DIV');
  });
});
