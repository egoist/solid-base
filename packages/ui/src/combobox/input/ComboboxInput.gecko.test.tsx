import { screen } from '@solidjs/testing-library';
import { Combobox } from '..';
import { DirectionProvider } from '../../direction-provider';
import { renderWithUser } from '../test-utils';

vi.mock('@egoist/solid-base-utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@egoist/solid-base-utils/platform')>();
  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: {
        ...actual.platform.engine,
        gecko: true,
      },
    },
  };
});

describe('<Combobox.Input /> in Gecko RTL', () => {
  it('uses Gecko RTL caret positions for Home and End', async () => {
    const { user } = renderWithUser(() => (
      <DirectionProvider direction="rtl">
        <Combobox.Root defaultInputValue="apple">
          <Combobox.Input />
        </Combobox.Root>
      </DirectionProvider>
    ));

    const input = screen.getByRole<HTMLInputElement>('combobox');
    input.focus();

    await user.keyboard('{Home}');
    expect(input.selectionStart).toBe(input.value.length);

    await user.keyboard('{End}');
    expect(input.selectionStart).toBe(0);
  });
});
