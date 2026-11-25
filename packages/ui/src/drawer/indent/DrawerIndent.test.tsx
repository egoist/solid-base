import { describe, expect, it } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Drawer } from '..';
import { renderWithProps } from '../../dialog/test-utils';

function TestCase(props: { open: boolean }) {
  return (
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="bg" />
      <Drawer.Indent data-testid="indent">
        <Drawer.Root open={props.open}>
          <Drawer.Trigger>Open</Drawer.Trigger>
        </Drawer.Root>
      </Drawer.Indent>
    </Drawer.Provider>
  );
}

describe('<Drawer.Indent />', () => {
  it('renders a div with class, style, ref and render', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <Drawer.Provider>
        <Drawer.Indent
          data-testid="indent"
          class={(state) => (state.active ? 'active' : 'inactive')}
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        />
        <Drawer.Indent data-testid="rendered" render={(props) => <main {...props} />} />
      </Drawer.Provider>
    ));

    const indent = screen.getByTestId('indent');
    expect(indent.tagName).toBe('DIV');
    expect(indent).toHaveClass('inactive');
    expect(indent.style.color).toBe('red');
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(refElement).toBe(indent);
    expect(screen.getByTestId('rendered').tagName).toBe('MAIN');
  });

  it('sets data-active when any drawer is open', async () => {
    const { setProps } = renderWithProps((p: { open: boolean }) => <TestCase {...p} />, {
      open: false,
    });

    expect(screen.getByTestId('indent')).toHaveAttribute('data-inactive', '');
    expect(screen.getByTestId('indent')).not.toHaveAttribute('data-active');

    await setProps({ open: true });

    expect(screen.getByTestId('indent')).toHaveAttribute('data-active', '');
    expect(screen.getByTestId('indent')).not.toHaveAttribute('data-inactive');
    expect(screen.getByTestId('bg')).toHaveAttribute('data-active', '');
  });
});
