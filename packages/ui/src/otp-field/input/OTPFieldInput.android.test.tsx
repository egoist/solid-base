import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { OTPField } from '..';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
    '@egoist/solid-base-utils/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

describe('<OTPField.Input /> Android', () => {
  it('commits each change during an IME composition', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <OTPField.Root length={3} validationType="alphanumeric" onValueChange={onValueChange}>
        <OTPField.Input />
        <OTPField.Input />
        <OTPField.Input />
      </OTPField.Root>
    ));
    await Promise.resolve();
    flush();

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    inputs[0].focus();
    flush();

    fireEvent.compositionStart(inputs[0]);
    fireEvent.input(inputs[0], { target: { value: 'a' } });
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('a', expect.anything());
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.compositionEnd(inputs[0]);
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(inputs.map((input) => input.value)).toEqual(['a', '', '']);
  });
});
