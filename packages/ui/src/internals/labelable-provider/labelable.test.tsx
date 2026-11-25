import { createSignal, flush, Show } from 'solid-js';
import { render, screen, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Field } from '../../field';
import { LabelableProvider } from './LabelableProvider';
import { useLabelableContext } from './LabelableContext';
import { createLabel } from './createLabel';
import { createLabelableId } from './createLabelableId';
import { createAriaLabelledBy } from './createAriaLabelledBy';

describe('labelable-provider', () => {
  describe('createLabel', () => {
    it('preserves native label activation inside a shadow root', async () => {
      const user = userEvent.setup();
      const host = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);
      document.body.appendChild(host);

      try {
        const { unmount } = render(
          () => (
            <Field.Root>
              <Field.Label>Name</Field.Label>
              <Field.Control />
            </Field.Root>
          ),
          { container },
        );

        try {
          const control = within(container).getByRole('textbox', { name: 'Name' });
          await user.click(within(container).getByText('Name'));
          expect(shadowRoot.activeElement).toBe(control);
        } finally {
          unmount();
        }
      } finally {
        host.remove();
      }
    });

    it('focuses a control inside a shadow root from a non-native label', async () => {
      const user = userEvent.setup();
      const host = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);
      document.body.appendChild(host);
      // An element with the same id in the light DOM must not win over the shadow root's one.
      const unrelated = document.createElement('input');
      unrelated.id = 'outer';
      document.body.appendChild(unrelated);

      try {
        const { unmount } = render(
          () => (
            <>
              <Field.Root>
                <Field.Label nativeLabel={false} render="div">
                  Name
                </Field.Label>
                <Field.Control id="outer" />
              </Field.Root>
            </>
          ),
          { container },
        );

        try {
          await user.click(within(container).getByText('Name'));
          expect(shadowRoot.activeElement).toBe(
            within(container).getByRole('textbox', { name: 'Name' }),
          );
        } finally {
          unmount();
        }
      } finally {
        host.remove();
        unrelated.remove();
      }
    });

    it('does not focus the control when the click originates inside a nested button', async () => {
      const user = userEvent.setup();
      function Test() {
        const labelProps = createLabel({ fallbackControlId: () => 'control' });
        return (
          <>
            <div {...labelProps} data-testid="label">
              Label
              <button type="button">Action</button>
            </div>
            <input id="control" />
          </>
        );
      }

      render(() => <Test />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('textbox')).not.toHaveFocus();

      await user.click(screen.getByTestId('label'));
      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('renders `for` only for native labels', () => {
      const [native, setNative] = createSignal(true);
      function Test() {
        const labelProps = createLabel({
          native,
          fallbackControlId: () => 'control',
        });
        return <span {...labelProps} data-testid="label" />;
      }

      render(() => <Test />);
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'control');
      setNative(false);
      flush();
      expect(screen.getByTestId('label')).not.toHaveAttribute('for');
    });
  });

  describe('createLabelableId', () => {
    it('registers the control id in the provider and returns it', () => {
      const [id, setId] = createSignal<string | undefined>('first');
      let context!: ReturnType<typeof useLabelableContext>;
      function Control() {
        const controlId = createLabelableId({ id });
        return <input data-testid="control" id={controlId()} />;
      }
      function Spy() {
        context = useLabelableContext();
        return null;
      }

      render(() => (
        <LabelableProvider>
          <Spy />
          <Control />
        </LabelableProvider>
      ));

      expect(screen.getByTestId('control')).toHaveAttribute('id', 'first');
      expect(context.controlId()).toBe('first');

      setId('second');
      flush();
      expect(screen.getByTestId('control')).toHaveAttribute('id', 'second');
      expect(context.controlId()).toBe('second');

      // Removing the explicit id falls back to a generated one.
      setId(undefined);
      flush();
      expect(screen.getByTestId('control').id).toMatch(/^base-ui-/);
      expect(context.controlId()).toBe(screen.getByTestId('control').id);
    });

    it('returns its own id outside of a provider', () => {
      function Control() {
        const controlId = createLabelableId({ id: () => 'standalone' });
        return <input data-testid="control" id={controlId()} />;
      }
      render(() => <Control />);
      expect(screen.getByTestId('control')).toHaveAttribute('id', 'standalone');
    });
  });

  describe('createAriaLabelledBy', () => {
    function Control(props: { 'aria-labelledby'?: string; 'aria-label'?: string; labelId?: string }) {
      const [input, setInput] = createSignal<HTMLInputElement | null>(null);
      const ariaLabelledBy = createAriaLabelledBy({
        explicitAriaLabelledBy: () => props['aria-labelledby'],
        labelId: () => props.labelId,
        labelSource: input,
        labelSourceId: () => 'source',
        ariaLabel: () => props['aria-label'],
      });
      return (
        <>
          <span role="switch" aria-checked="false" aria-labelledby={ariaLabelledBy()} />
          <input ref={setInput} id="source" type="checkbox" />
        </>
      );
    }

    it('falls back to a wrapping native label and gives it an id', () => {
      render(() => (
        <label data-testid="label">
          <Control />
          Wrapped
        </label>
      ));

      const label = screen.getByTestId('label');
      expect(label.id).toBe('source-label');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-labelledby', 'source-label');
    });

    it('falls back to a sibling label pointing at the source', () => {
      render(() => (
        <div>
          <Control />
          <label for="source" id="sibling">
            Sibling
          </label>
        </div>
      ));

      expect(screen.getByRole('switch')).toHaveAttribute('aria-labelledby', 'sibling');
    });

    it('prefers explicit aria-labelledby, then the label id, and yields to aria-label', () => {
      const [explicit, setExplicit] = createSignal<string | undefined>('explicit');
      const [ariaLabel, setAriaLabel] = createSignal<string | undefined>(undefined);
      render(() => (
        <Control aria-labelledby={explicit()} aria-label={ariaLabel()} labelId="field-label" />
      ));

      const control = screen.getByRole('switch');
      expect(control).toHaveAttribute('aria-labelledby', 'explicit');

      setExplicit(undefined);
      flush();
      expect(control).toHaveAttribute('aria-labelledby', 'field-label');

      setAriaLabel('Named');
      flush();
      expect(control).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('LabelableProvider', () => {
    it('merges descriptions of the parent scope', () => {
      const [shown, setShown] = createSignal(true);
      function Control() {
        const { getDescriptionProps } = useLabelableContext();
        return <input {...getDescriptionProps({ 'aria-describedby': 'external' })} />;
      }

      render(() => (
        <Field.Root>
          <Show when={shown()}>
            <Field.Description>Outer</Field.Description>
          </Show>
          <Field.Item>
            <Field.Description>Inner</Field.Description>
            <Control />
          </Field.Item>
        </Field.Root>
      ));

      expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(
        `external ${screen.getByText('Outer').id} ${screen.getByText('Inner').id}`,
      );

      setShown(false);
      flush();
      expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(
        `external ${screen.getByText('Inner').id}`,
      );
    });
  });
});
