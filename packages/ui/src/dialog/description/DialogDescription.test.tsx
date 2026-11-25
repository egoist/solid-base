import { render, screen } from '@solidjs/testing-library';
import { Dialog } from '..';

describe('<Dialog.Description />', () => {
  it('forwards ref, class, style and supports render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Description
              ref={(el) => {
                ref = el;
              }}
              class="description"
              style={{ color: 'red' }}
              render="div"
            >
              Text
            </Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const description = screen.getByText('Text');
    expect(ref).toBe(description);
    expect(description.tagName).toBe('DIV');
    expect(description).toHaveClass('description');
    expect(description).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders a paragraph that describes the popup', () => {
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Description>Text</Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const description = screen.getByText('Text');
    expect(description).toBeInstanceOf(window.HTMLParagraphElement);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', description.id);
  });

  it('uses a custom id', () => {
    render(() => (
      <Dialog.Root open modal={false}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Description id="custom">Text</Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'custom');
  });
});
