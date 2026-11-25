import { For, Show, createSignal } from 'solid-js';
import { Autocomplete } from '@egoist/solid-base/autocomplete';
import { Button } from '@egoist/solid-base/button';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import { Combobox } from '@egoist/solid-base/combobox';
import { Field } from '@egoist/solid-base/field';
import { Fieldset } from '@egoist/solid-base/fieldset';
import { Form } from '@egoist/solid-base/form';
import { NumberField } from '@egoist/solid-base/number-field';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import { Select } from '@egoist/solid-base/select';
import { Slider } from '@egoist/solid-base/slider';
import { Switch } from '@egoist/solid-base/switch';
import styles from './forms.module.css';

export default function ExampleForm() {
  const [submitted, setSubmitted] = createSignal<Record<string, unknown>>();

  return (
    <div class={styles.Wrapper}>
      <Form
        class={styles.Form}
        aria-label="Launch new cloud server"
        onFormSubmit={(formValues) => setSubmitted(formValues)}
      >
        <Field.Root name="serverName" class={styles.Field}>
          <Field.Label class={styles.Label}>Server name</Field.Label>
          <Field.Control
            defaultValue=""
            placeholder="e.g. api-server-01"
            required
            minlength={3}
            pattern=".*[A-Za-z].*"
            class={styles.Input}
          />
          <Field.Description class={styles.Description}>
            Must be 3 or more characters long
          </Field.Description>
          <Field.Error class={styles.Error} />
        </Field.Root>

        <Field.Root name="region" class={styles.Field}>
          <Combobox.Root items={REGIONS} required>
            <Field.Label class={styles.Label}>Region</Field.Label>
            <Combobox.InputGroup class={styles.InputGroup}>
              <Combobox.Input placeholder="e.g. eu-central-1" class={styles.Input} />
              <div class={styles.InputActions}>
                <Combobox.Clear class={styles.IconButton} aria-label="Clear selection">
                  <XIcon />
                </Combobox.Clear>
                <Combobox.Trigger class={styles.IconButton} aria-label="Open popup">
                  <CaretDownIcon />
                </Combobox.Trigger>
              </div>
            </Combobox.InputGroup>
            <Combobox.Portal>
              <Combobox.Positioner class={styles.Positioner} sideOffset={4}>
                <Combobox.Popup class={styles.Popup}>
                  <Combobox.Empty class={styles.Empty}>No matches</Combobox.Empty>
                  <Combobox.List class={styles.List}>
                    {(region: string) => (
                      <Combobox.Item value={region} class={styles.Item}>
                        <Combobox.ItemIndicator class={styles.ItemIndicator}>
                          <CheckIcon />
                        </Combobox.ItemIndicator>
                        <span class={styles.ItemText}>{region}</span>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error class={styles.Error} />
        </Field.Root>

        <Field.Root name="containerImage" class={styles.Field}>
          <Autocomplete.Root
            items={IMAGES}
            mode="both"
            itemToStringValue={(image: Image) => image.url}
            required
          >
            <Field.Label class={styles.Label}>Container image</Field.Label>
            <Autocomplete.Input
              placeholder="e.g. docker.io/library/node:latest"
              class={styles.Input}
            />
            <Field.Description class={styles.Description}>
              Enter a registry URL with optional tags
            </Field.Description>
            <Autocomplete.Portal>
              <Autocomplete.Positioner class={styles.Positioner} sideOffset={4}>
                <Autocomplete.Popup class={styles.Popup}>
                  <Autocomplete.List class={styles.List}>
                    {(image: Image) => (
                      <Autocomplete.Item value={image} class={styles.ImageItem}>
                        <span>{image.name}</span>
                        <span class={styles.Mono}>{image.url}</span>
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Error class={styles.Error} />
        </Field.Root>

        <Field.Root name="serverType" class={styles.Field}>
          <Select.Root items={SERVER_TYPES} required>
            <Select.Label class={styles.Label}>Server type</Select.Label>
            <Select.Trigger class={styles.Select}>
              <Select.Value />
              <Select.Icon class={styles.SelectIcon}>
                <CaretUpDownIcon />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner class={styles.Positioner} sideOffset={4}>
                <Select.Popup class={styles.Popup}>
                  <Select.List class={styles.List}>
                    <For each={SERVER_TYPES}>
                      {(type) => (
                        <Select.Item value={type.value} class={styles.Item}>
                          <Select.ItemIndicator class={styles.ItemIndicator}>
                            <CheckIcon />
                          </Select.ItemIndicator>
                          <Select.ItemText class={styles.ItemText}>{type.label}</Select.ItemText>
                        </Select.Item>
                      )}
                    </For>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error class={styles.Error} />
        </Field.Root>

        <Field.Root name="numOfInstances" class={styles.Field}>
          <NumberField.Root min={1} max={64} required>
            <Field.Label class={styles.Label}>Number of instances</Field.Label>
            <NumberField.Group class={styles.NumberGroup}>
              <NumberField.Decrement class={styles.NumberButton}>
                <MinusIcon />
              </NumberField.Decrement>
              <NumberField.Input class={styles.NumberInput} />
              <NumberField.Increment class={styles.NumberButton}>
                <PlusIcon />
              </NumberField.Increment>
            </NumberField.Group>
          </NumberField.Root>
          <Field.Error class={styles.Error} />
        </Field.Root>

        <Field.Root name="scalingThreshold" class={styles.Field}>
          <Fieldset.Root
            class={styles.SliderFieldset}
            render={(props) => (
              <Slider.Root
                {...props}
                defaultValue={[0.2, 0.8]}
                thumbAlignment="edge"
                min={0}
                max={1}
                step={0.01}
                format={{
                  style: 'percent',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
              />
            )}
          >
            <Fieldset.Legend class={styles.Label}>Scaling threshold</Fieldset.Legend>
            <Slider.Value class={styles.SliderValue} />
            <Slider.Control class={styles.SliderControl}>
              <Slider.Track class={styles.SliderTrack}>
                <Slider.Indicator class={styles.SliderIndicator} />
                <Slider.Thumb index={0} aria-label="Minimum threshold" class={styles.SliderThumb} />
                <Slider.Thumb index={1} aria-label="Maximum threshold" class={styles.SliderThumb} />
              </Slider.Track>
            </Slider.Control>
          </Fieldset.Root>
        </Field.Root>

        <Field.Root name="storageType" class={styles.Field}>
          <Fieldset.Root
            class={styles.Group}
            render={(props) => <RadioGroup {...props} defaultValue="ssd" />}
          >
            <Fieldset.Legend class={styles.Label}>Storage type</Fieldset.Legend>
            <div class={styles.Options}>
              <For each={['ssd', 'hdd']}>
                {(value) => (
                  <Field.Item>
                    <Field.Label class={styles.Option}>
                      <Radio.Root value={value} class={styles.Radio}>
                        <Radio.Indicator class={styles.RadioIndicator} />
                      </Radio.Root>
                      {value.toUpperCase()}
                    </Field.Label>
                  </Field.Item>
                )}
              </For>
            </div>
          </Fieldset.Root>
        </Field.Root>

        <Field.Root name="restartOnFailure" class={styles.Field}>
          <Field.Label class={styles.Option}>
            <Switch.Root defaultChecked class={styles.Switch}>
              <Switch.Thumb class={styles.SwitchThumb} />
            </Switch.Root>
            Restart on failure
          </Field.Label>
        </Field.Root>

        <Field.Root name="allowedNetworkProtocols" class={styles.Field}>
          <Fieldset.Root
            class={styles.Group}
            render={(props) => <CheckboxGroup {...props} defaultValue={[]} />}
          >
            <Fieldset.Legend class={styles.Label}>Allowed network protocols</Fieldset.Legend>
            <div class={styles.Options}>
              <For each={['http', 'https', 'ssh']}>
                {(value) => (
                  <Field.Item>
                    <Field.Label class={styles.Option}>
                      <Checkbox.Root value={value} class={styles.Checkbox}>
                        <Checkbox.Indicator class={styles.CheckboxIndicator}>
                          <CheckIcon />
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                      {value.toUpperCase()}
                    </Field.Label>
                  </Field.Item>
                )}
              </For>
            </div>
          </Fieldset.Root>
        </Field.Root>

        <Button type="submit" class={styles.Submit}>
          Launch server
        </Button>
      </Form>

      <Show when={submitted()}>
        {(values) => (
          <output class={styles.Output}>
            <span class={styles.OutputTitle}>onFormSubmit</span>
            <pre>{JSON.stringify(values(), null, 2)}</pre>
          </output>
        )}
      </Show>
    </div>
  );
}

function cartesian(...arrays: string[][]): string[][] {
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
  );
}

const REGIONS = cartesian(['us', 'eu', 'ap'], ['central', 'east', 'west'], ['1', '2', '3']).map(
  (part) => part.join('-'),
);

interface Image {
  url: string;
  name: string;
}

const IMAGES: Image[] = ['nginx:1.29-alpine', 'node:22-slim', 'postgres:18', 'redis:8.2.2-alpine'].map(
  (name) => ({ url: `docker.io/library/${name}`, name }),
);

const SERVER_TYPES = [
  { label: 'Select server type', value: null },
  ...cartesian(['t', 'm'], ['1', '2'], ['small', 'medium', 'large']).map((part) => {
    const value = part.join('.').replace('.', '');
    return { label: value, value };
  }),
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="m4.5 4.5 7 7m-7 0 7-7" />
    </svg>
  );
}

function CaretDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}

function CaretUpDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M1.5 8h13" />
    </svg>
  );
}
