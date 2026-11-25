import { render, screen } from '@solidjs/testing-library';
import { NumberField } from '..';

vi.mock('@egoist/solid-base-utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('@egoist/solid-base-utils/platform')>(
      '@egoist/solid-base-utils/platform',
    );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, ios: true, apple: true },
    },
  };
});

describe('<NumberField.Root /> iOS', () => {

  // The iOS numeric software keyboard has no decimal key, and no minus key at all, so the input
  // mode is widened just enough to keep every valid character typeable.
  it('uses the decimal keyboard when negative values are impossible', async () => {
    render(() => (
      <NumberField.Root min={0}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'decimal');
  });

  it('uses the text keyboard when negative values are allowed', async () => {
    render(() => (
      <NumberField.Root min={-5}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'text');
  });

  it('uses the text keyboard when no minimum is set', async () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'text');
  });
});
