import { describe, expect, it } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { Drawer } from '..';

function renderInPopup(content: () => JSX.Element) {
  return render(() => (
    <Drawer.Root open>
      <Drawer.Portal>
        <Drawer.Viewport>
          <Drawer.Popup>{content()}</Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  ));
}

describe('<Drawer.Content />', () => {
  it('renders a div with class, style and ref', () => {
    let refElement: HTMLElement | undefined;
    renderInPopup(() => (
      <Drawer.Content
        data-testid="content"
        class="content"
        style={{ color: 'red' }}
        ref={(element) => {
          refElement = element;
        }}
      />
    ));

    const content = screen.getByTestId('content');
    expect(content.tagName).toBe('DIV');
    expect(content).toHaveClass('content');
    expect(content.style.color).toBe('red');
    expect(refElement).toBe(content);
    expect(content).toHaveAttribute('data-drawer-content');
  });

  it('supports the render prop', () => {
    renderInPopup(() => (
      <Drawer.Content data-testid="content" render={(props) => <section {...props} />} />
    ));

    expect(screen.getByTestId('content').tagName).toBe('SECTION');
  });

  it('does not add public swipe-ignore attributes', () => {
    renderInPopup(() => <Drawer.Content data-testid="content">Content</Drawer.Content>);

    expect(screen.getByTestId('content')).not.toHaveAttribute('data-swipe-ignore');
    expect(screen.getByTestId('content')).not.toHaveAttribute('data-base-ui-swipe-ignore');
  });
});
