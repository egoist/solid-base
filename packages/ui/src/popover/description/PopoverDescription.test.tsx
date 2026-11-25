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

describe('<Popover.Description />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    renderInPopup(() => (
      <Popover.Description
        ref={(el) => {
          ref = el;
        }}
        class="description"
        style={{ color: 'red' }}
        render="span"
      >
        Description
      </Popover.Description>
    ));
    const description = screen.getByText('Description');
    expect(ref).toBe(description);
    expect(description.tagName).toBe('SPAN');
    expect(description).toHaveClass('description');
    expect(description).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('describes the popup element with its id', () => {
    renderInPopup(() => <Popover.Description>Description</Popover.Description>);
    const description = screen.getByText('Description');
    expect(description).toBeInstanceOf(window.HTMLParagraphElement);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', description.id);
  });

  describe('prop: id', () => {
    it('describes the popup element with a custom id', () => {
      renderInPopup(() => (
        <Popover.Description id="custom-description">Description</Popover.Description>
      ));
      expect(screen.getByText('Description')).toHaveAttribute('id', 'custom-description');
      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-describedby',
        'custom-description',
      );
    });

    it('keeps the generated id when undefined', () => {
      renderInPopup(() => <Popover.Description id={undefined}>Description</Popover.Description>);
      const description = screen.getByText('Description');
      expect(description.id).not.toBe('');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', description.id);
    });
  });
});
