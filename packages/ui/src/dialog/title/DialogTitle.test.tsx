import { render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';

describe('<Dialog.Title />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title
              ref={(el) => {
                ref = el;
              }}
              class="title"
              style={{ color: 'red' }}
              render="h3"
            >
              Title
            </Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const title = screen.getByText('Title');
    expect(ref).toBe(title);
    expect(title.tagName).toBe('H3');
    expect(title).toHaveClass('title');
    expect(title).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders a heading that labels the popup', () => {
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>Title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const title = screen.getByText('Title');
    expect(title).toBeInstanceOf(window.HTMLHeadingElement);
    expect(title.tagName).toBe('H2');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', title.id);
  });

  it('uses a custom id', () => {
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title id="custom">Title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'custom');
  });
});
