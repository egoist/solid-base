import { Errored } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { useComboboxDerivedItemsContext, useComboboxRootContext } from './ComboboxRootContext';

describe('ComboboxRootContext', () => {
  const cases = [
    {
      name: 'useComboboxRootContext',
      useContext: useComboboxRootContext,
      message:
        'Base UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    },
    {
      name: 'useComboboxDerivedItemsContext',
      useContext: useComboboxDerivedItemsContext,
      message:
        'Base UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    },
  ];

  it.each(cases)('$name throws when its provider is missing', ({ useContext, message }) => {
    function Consumer() {
      useContext();
      return null;
    }

    render(() => (
      <Errored fallback={(error) => <div data-testid="error">{String(error())}</div>}>
        <Consumer />
      </Errored>
    ));

    expect(screen.getByTestId('error')).toHaveTextContent(message);
  });
});
