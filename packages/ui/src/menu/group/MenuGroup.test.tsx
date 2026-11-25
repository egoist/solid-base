import { render, screen } from '@solidjs/testing-library';
import { Menu } from '..';

describe('<Menu.Group />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Menu.Group
        ref={(el) => {
          ref = el;
        }}
        class="group"
        style={{ color: 'red' }}
        render={(props) => <section {...props} />}
      />
    ));
    const group = screen.getByRole('group');
    expect(ref).toBe(group);
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveClass('group');
    expect(group.style.color).toBe('red');
  });

  it('renders a div with the `group` role', () => {
    render(() => <Menu.Group />);
    expect(screen.getByRole('group')).toBeVisible();
    expect(screen.getByRole('group').tagName).toBe('DIV');
  });
});
