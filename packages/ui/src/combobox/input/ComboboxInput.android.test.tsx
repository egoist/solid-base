import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Combobox } from '..';

vi.mock('@egoist/solid-base-utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@egoist/solid-base-utils/platform')>();
  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: {
        ...actual.platform.os,
        android: true,
      },
    },
  };
});

describe('<Combobox.Input /> on Android', () => {
  it('propagates changes during Android composition', () => {
    const onInputValueChange = vi.fn();
    render(() => (
      <Combobox.Root onInputValueChange={onInputValueChange}>
        <Combobox.Input />
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: 'a' } });
    flush();

    expect(onInputValueChange).toHaveBeenCalledWith('a', expect.anything());
  });
});
