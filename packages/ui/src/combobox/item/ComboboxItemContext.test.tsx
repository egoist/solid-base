import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { useComboboxItemContext } from './ComboboxItemContext';

describe('ComboboxItemContext', () => {
  it('throws a descriptive error when used outside <Combobox.Item>', () => {
    function Consumer() {
      useComboboxItemContext();
      return null;
    }

    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Consumer />
      </Errored>
    ));

    expect(screen.getByTestId('error')).toHaveTextContent(
      'Base UI: ComboboxItemContext is missing. ComboboxItem parts must be placed within <Combobox.Item>.',
    );
  });
});
