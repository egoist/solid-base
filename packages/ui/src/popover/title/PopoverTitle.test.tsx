import { render, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { Popover } from '..';

function renderInPopup(node: () => JSX.Element) {
  return render(() => (
    <Popover.Root open>
      <Popover.Trigger>Trigger</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>{node()}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ));
}

describe('<Popover.Title />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    renderInPopup(() => (
      <Popover.Title
        ref={(el) => {
          ref = el;
        }}
        class="title"
        style={{ color: 'red' }}
        render="h3"
      >
        Title
      </Popover.Title>
    ));
    const title = screen.getByText('Title');
    expect(ref).toBe(title);
    expect(title.tagName).toBe('H3');
    expect(title).toHaveClass('title');
    expect(title).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('labels the popup element with its id', () => {
    renderInPopup(() => <Popover.Title>Title</Popover.Title>);
    const heading = document.querySelector('h2')!;
    expect(heading).toBeInstanceOf(window.HTMLHeadingElement);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', heading.id);
  });

  describe('prop: id', () => {
    it('labels the popup element with a custom id', () => {
      renderInPopup(() => <Popover.Title id="custom-title">Title</Popover.Title>);
      expect(screen.getByRole('heading')).toHaveAttribute('id', 'custom-title');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'custom-title');
    });

    it('keeps the generated id when undefined', () => {
      renderInPopup(() => <Popover.Title id={undefined}>Title</Popover.Title>);
      const title = screen.getByRole('heading');
      expect(title.id).not.toBe('');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', title.id);
    });
  });
});
