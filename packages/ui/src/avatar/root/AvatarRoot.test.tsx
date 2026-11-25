import { render, screen } from '@solidjs/testing-library';
import { Avatar } from '..';

describe('<Avatar.Root />', () => {
  it('renders a span with class, style, ref and render support', () => {
    let refElement: HTMLElement | undefined;
    render(() => (
      <>
        <Avatar.Root
          data-testid="root"
          class="avatar"
          style={{ color: 'red' }}
          ref={(element) => {
            refElement = element;
          }}
        >
          JD
        </Avatar.Root>
        <Avatar.Root
          render={(props, state) => (
            <div {...props} data-testid="custom" data-status={state.imageLoadingStatus} />
          )}
        />
      </>
    ));
    const root = screen.getByTestId('root');
    expect(root.tagName).toBe('SPAN');
    expect(root).toHaveClass('avatar');
    expect(root.style.color).toBe('red');
    expect(root).toHaveTextContent('JD');
    expect(refElement).toBe(root);
    expect(screen.getByTestId('custom').tagName).toBe('DIV');
    expect(screen.getByTestId('custom')).toHaveAttribute('data-status', 'idle');
  });
});
