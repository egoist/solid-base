import { describe, expect, it } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Drawer } from '..';
import { renderWithProps } from '../../dialog/test-utils';

function TestCase(props: { open: boolean }) {
  return (
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="bg" />
      <Drawer.Root open={props.open}>
        <Drawer.Trigger>Open</Drawer.Trigger>
      </Drawer.Root>
    </Drawer.Provider>
  );
}

describe('<Drawer.IndentBackground />', () => {
  it('renders a div with class, style, ref and render', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <>
        <Drawer.IndentBackground
          data-testid="bg"
          class={(state) => (state.active ? 'active' : 'inactive')}
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <Drawer.IndentBackground data-testid="rendered" render={(props) => <span {...props} />} />
      </>
    ));

    const background = screen.getByTestId('bg');
    expect(background.tagName).toBe('DIV');
    expect(background).toHaveClass('inactive');
    expect(background.style.color).toBe('red');
    expect(refElement).toBe(background);
    expect(screen.getByTestId('rendered').tagName).toBe('SPAN');
  });

  it('sets data-active when any drawer is open', async () => {
    const { setProps } = renderWithProps((p: { open: boolean }) => <TestCase {...p} />, {
      open: false,
    });

    const background = screen.getByTestId('bg');

    expect(background.getAttribute('data-inactive')).toBe('');
    expect(background.getAttribute('data-active')).toBeNull();

    await setProps({ open: true });

    expect(background.getAttribute('data-active')).toBe('');
    expect(background.getAttribute('data-inactive')).toBeNull();
  });
});
