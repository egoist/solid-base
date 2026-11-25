import type { JSX } from '@solidjs/web';
import { render, screen } from '@solidjs/testing-library';
import { Autocomplete } from '../../autocomplete';
import { Combobox } from '../../combobox';
import { Select } from '../../select';
import { ListboxSeparator } from './ListboxSeparator';

describe('<ListboxSeparator />', () => {
  it('forwards ref, class, style and render', () => {
    let ref: HTMLElement | undefined;
    render(() => (
      <ListboxSeparator
        data-testid="separator"
        ref={(el) => {
          ref = el;
        }}
        class={(state) => `separator-${state.orientation}`}
        style={{ color: 'red' }}
        render={(props) => <section {...props} />}
      />
    ));

    const separator = screen.getByTestId('separator');
    expect(ref).toBe(separator);
    expect(separator.tagName).toBe('SECTION');
    expect(separator).toHaveClass('separator-horizontal');
    expect(separator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('has role="presentation" and defaults to horizontal', () => {
    render(() => <ListboxSeparator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveAttribute('role', 'presentation');
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    expect(separator).not.toHaveAttribute('aria-orientation');
  });

  describe('prop: orientation', () => {
    it.each([{ orientation: 'horizontal' as const }, { orientation: 'vertical' as const }])(
      'sets data-orientation to $orientation',
      ({ orientation }) => {
        render(() => <ListboxSeparator orientation={orientation} data-testid="separator" />);

        const separator = screen.getByTestId('separator');
        expect(separator).toHaveAttribute('data-orientation', orientation);
        expect(separator).not.toHaveAttribute('aria-orientation');
      },
    );
  });

  describe.each<[string, () => JSX.Element]>([
    ['Autocomplete.Separator', () => <Autocomplete.Separator data-testid="separator" />],
    ['Combobox.Separator', () => <Combobox.Separator data-testid="separator" />],
    ['Select.Separator', () => <Select.Separator data-testid="separator" />],
  ])('%s', (_, separator) => {
    it('exposes the listbox separator behavior', () => {
      render(separator);

      const element = screen.getByTestId('separator');
      expect(element).toHaveAttribute('role', 'presentation');
      expect(element).toHaveAttribute('data-orientation', 'horizontal');
      expect(element).not.toHaveAttribute('aria-orientation');
    });
  });
});
