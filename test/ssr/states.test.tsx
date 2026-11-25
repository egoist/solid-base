import { renderToString, type JSX } from '@solidjs/web';
import { Accordion } from '@egoist/solid-base/accordion';
import { AlertDialog } from '@egoist/solid-base/alert-dialog';
import { Autocomplete } from '@egoist/solid-base/autocomplete';
import { Avatar } from '@egoist/solid-base/avatar';
import { Button } from '@egoist/solid-base/button';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import { Collapsible } from '@egoist/solid-base/collapsible';
import { Combobox } from '@egoist/solid-base/combobox';
import { ContextMenu } from '@egoist/solid-base/context-menu';
import { CSPProvider } from '@egoist/solid-base/csp-provider';
import { Dialog } from '@egoist/solid-base/dialog';
import { DirectionProvider } from '@egoist/solid-base/direction-provider';
import { Drawer } from '@egoist/solid-base/drawer';
import { Field } from '@egoist/solid-base/field';
import { Fieldset } from '@egoist/solid-base/fieldset';
import { Form } from '@egoist/solid-base/form';
import { Input } from '@egoist/solid-base/input';
import { Menu } from '@egoist/solid-base/menu';
import { Menubar } from '@egoist/solid-base/menubar';
import { Meter } from '@egoist/solid-base/meter';
import { NavigationMenu } from '@egoist/solid-base/navigation-menu';
import { NumberField } from '@egoist/solid-base/number-field';
import { OTPField } from '@egoist/solid-base/otp-field';
import { Popover } from '@egoist/solid-base/popover';
import { PreviewCard } from '@egoist/solid-base/preview-card';
import { Progress } from '@egoist/solid-base/progress';
import { Radio } from '@egoist/solid-base/radio';
import { RadioGroup } from '@egoist/solid-base/radio-group';
import { ScrollArea } from '@egoist/solid-base/scroll-area';
import { Select } from '@egoist/solid-base/select';
import { Separator } from '@egoist/solid-base/separator';
import { Slider } from '@egoist/solid-base/slider';
import { Switch } from '@egoist/solid-base/switch';
import { Tabs } from '@egoist/solid-base/tabs';
import { Toast } from '@egoist/solid-base/toast';
import { Toggle } from '@egoist/solid-base/toggle';
import { ToggleGroup } from '@egoist/solid-base/toggle-group';
import { Toolbar } from '@egoist/solid-base/toolbar';
import { Tooltip } from '@egoist/solid-base/tooltip';

// Server-renders components in states that exercise more code paths than the playground demos:
// open popups (their portals render nothing on the server, but roots and triggers run), default
// values, Field/Form-wrapped controls, and parts that register with their parents.

const fruits = ['apple', 'banana', 'cherry'];
const selectItems = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
];

function MenuContent() {
  return (
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item>Item</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

const cases: Record<string, () => JSX.Element> = {
  'accordion with an open item': () => (
    <Accordion.Root defaultValue={['one']}>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>One</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Panel one</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="two" disabled>
        <Accordion.Header>
          <Accordion.Trigger>Two</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel keepMounted>Panel two</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  'collapsible open by default': () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  'collapsible closed with a kept-mounted panel': () => (
    <Collapsible.Root>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  'tabs with a default value and an indicator': () => (
    <Tabs.Root defaultValue="b">
      <Tabs.List>
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
        <Tabs.Tab value="c" disabled>
          C
        </Tabs.Tab>
        <Tabs.Indicator renderBeforeHydration />
      </Tabs.List>
      <Tabs.Panel value="a">Panel A</Tabs.Panel>
      <Tabs.Panel value="b">Panel B</Tabs.Panel>
      <Tabs.Panel value="c" keepMounted>
        Panel C
      </Tabs.Panel>
    </Tabs.Root>
  ),
  'vertical tabs, controlled': () => (
    <Tabs.Root value="a" orientation="vertical">
      <Tabs.List activateOnFocus>
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a">Panel A</Tabs.Panel>
    </Tabs.Root>
  ),
  'select with a default value inside a field': () => (
    <Form>
      <Field.Root name="fruit">
        <Field.Label>Fruit</Field.Label>
        <Select.Root items={selectItems} defaultValue="banana" required>
          <Select.Label>Fruit</Select.Label>
          <Select.Trigger>
            <Select.Value placeholder="Pick one" />
            <Select.Icon />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List>
                  {selectItems.map((item) => (
                    <Select.Item value={item.value}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Field.Description>Choose a fruit</Field.Description>
        <Field.Error />
      </Field.Root>
    </Form>
  ),
  'select open, multiple': () => (
    <Select.Root items={selectItems} defaultValue={['apple', 'banana']} multiple open>
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  ),
  'combobox with a default value inside a field': () => (
    <Field.Root name="fruit">
      <Combobox.Root items={fruits} defaultValue="banana">
        <Combobox.Label>Fruit</Combobox.Label>
        <Combobox.InputGroup>
          <Combobox.Input />
          <Combobox.Clear />
          <Combobox.Trigger />
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <Field.Error />
    </Field.Root>
  ),
  'combobox with an inline open list': () => (
    <Combobox.Root items={fruits} defaultValue="cherry" inline open>
      <Combobox.Input />
      <Combobox.Status />
      <Combobox.Empty>No fruits</Combobox.Empty>
      <Combobox.List>
        {(item: string) => (
          <Combobox.Item value={item}>
            <Combobox.ItemIndicator />
            {item}
          </Combobox.Item>
        )}
      </Combobox.List>
    </Combobox.Root>
  ),
  'combobox with chips': () => (
    <Combobox.Root items={fruits} defaultValue={['apple', 'banana']} multiple>
      <Combobox.Chips>
        <Combobox.Value>
          {(value: string[]) =>
            value.map((item) => (
              <Combobox.Chip>
                {item}
                <Combobox.ChipRemove />
              </Combobox.Chip>
            ))
          }
        </Combobox.Value>
        <Combobox.Input />
      </Combobox.Chips>
    </Combobox.Root>
  ),
  'autocomplete with an inline open list': () => (
    <Autocomplete.Root items={fruits} defaultValue="ap" inline open>
      <Autocomplete.Input />
      <Autocomplete.List>
        {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
      </Autocomplete.List>
    </Autocomplete.Root>
  ),
  'menu open by default': () => (
    <Menu.Root defaultOpen>
      <Menu.Trigger>Open</Menu.Trigger>
      <MenuContent />
    </Menu.Root>
  ),
  'menu with a detached trigger': () => {
    const handle = Menu.createHandle();
    return (
      <>
        <Menu.Trigger handle={handle}>Open</Menu.Trigger>
        <Menu.Root handle={handle} defaultOpen>
          <MenuContent />
        </Menu.Root>
      </>
    );
  },
  'context menu open by default': () => (
    <ContextMenu.Root defaultOpen>
      <ContextMenu.Trigger>Right click</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.Item>Item</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  ),
  'menubar with an open menu': () => (
    <Menubar>
      <Menu.Root defaultOpen>
        <Menu.Trigger>File</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
      <Menu.Root disabled>
        <Menu.Trigger>View</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
    </Menubar>
  ),
  'navigation menu with an open item': () => (
    <NavigationMenu.Root defaultValue="one">
      <NavigationMenu.List>
        <NavigationMenu.Item value="one">
          <NavigationMenu.Trigger>
            One
            <NavigationMenu.Icon />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="#one">Link</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="two">
          <NavigationMenu.Trigger>Two</NavigationMenu.Trigger>
          <NavigationMenu.Content>Two content</NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#three">Three</NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  ),
  'popover open by default': () => (
    <Popover.Root defaultOpen>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <Popover.Title>Title</Popover.Title>
            <Popover.Description>Description</Popover.Description>
            <Popover.Close>Close</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  'popover with detached triggers': () => {
    const handle = Popover.createHandle<string>();
    return (
      <>
        <Popover.Trigger handle={handle} payload="a">
          A
        </Popover.Trigger>
        <Popover.Trigger handle={handle} payload="b">
          B
        </Popover.Trigger>
        <Popover.Root handle={handle} defaultOpen>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    );
  },
  'tooltip open by default': () => (
    <Tooltip.Provider>
      <Tooltip.Root defaultOpen>
        <Tooltip.Trigger>Hover</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  ),
  'preview card open by default': () => (
    <PreviewCard.Root defaultOpen>
      <PreviewCard.Trigger href="#">Link</PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner>
          <PreviewCard.Popup>Card</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ),
  'dialog open by default': () => (
    <Dialog.Root defaultOpen>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  'alert dialog open': () => (
    <AlertDialog.Root open>
      <AlertDialog.Trigger>Open</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Popup>
          <AlertDialog.Title>Title</AlertDialog.Title>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  ),
  'drawer open inside a provider': () => (
    <Drawer.Provider>
      <Drawer.IndentBackground />
      <Drawer.Indent>
        <Drawer.Root defaultOpen>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Content>
                  <Drawer.Title>Title</Drawer.Title>
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
        <Drawer.Root>
          <Drawer.SwipeArea />
          <Drawer.Trigger>Second</Drawer.Trigger>
        </Drawer.Root>
      </Drawer.Indent>
    </Drawer.Provider>
  ),
  'toast provider with a rendered toast': () => (
    <Toast.Provider>
      <Toast.Viewport>
        <Toast.Root toast={{ id: 'toast-1', title: 'Saved', description: 'Your file was saved.' }}>
          <Toast.Content>
            <Toast.Title />
            <Toast.Description />
            <Toast.Action>Undo</Toast.Action>
            <Toast.Close>Dismiss</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      </Toast.Viewport>
    </Toast.Provider>
  ),
  'toast provider with a manager': () => {
    const toastManager = Toast.createToastManager();
    return (
      <Toast.Provider toastManager={toastManager} limit={2} timeout={1000}>
        <Toast.Viewport />
        <Toast.Portal>
          <Toast.Viewport />
        </Toast.Portal>
      </Toast.Provider>
    );
  },
  'form with validated fields': () => (
    <Form errors={{ email: 'Invalid email' }}>
      <Fieldset.Root>
        <Fieldset.Legend>Account</Fieldset.Legend>
        <Field.Root name="email" invalid>
          <Field.Label>Email</Field.Label>
          <Field.Control type="email" required defaultValue="a@" />
          <Field.Description>Your email</Field.Description>
          <Field.Error match />
          <Field.Validity>{(validity) => <span>{String(validity.validity.valid)}</span>}</Field.Validity>
        </Field.Root>
        <Field.Root name="name" disabled>
          <Field.Label>Name</Field.Label>
          <Input />
        </Field.Root>
      </Fieldset.Root>
      <Button type="submit">Submit</Button>
    </Form>
  ),
  'field-wrapped checkbox, switch and radio group': () => (
    <Form>
      <Field.Root name="terms">
        <Field.Label>
          <Checkbox.Root defaultChecked>
            <Checkbox.Indicator />
          </Checkbox.Root>
          Accept
        </Field.Label>
      </Field.Root>
      <Field.Root name="notifications">
        <Field.Label>Notifications</Field.Label>
        <Switch.Root defaultChecked>
          <Switch.Thumb />
        </Switch.Root>
        <Field.Description>Get notified</Field.Description>
      </Field.Root>
      <Field.Root name="size">
        <Fieldset.Root render={(props) => <RadioGroup {...props} defaultValue="m" />}>
          <Fieldset.Legend>Size</Fieldset.Legend>
          <Field.Item>
            <Field.Label>
              <Radio.Root value="s">
                <Radio.Indicator />
              </Radio.Root>
              Small
            </Field.Label>
          </Field.Item>
          <Field.Item>
            <Field.Label>
              <Radio.Root value="m">
                <Radio.Indicator />
              </Radio.Root>
              Medium
            </Field.Label>
          </Field.Item>
        </Fieldset.Root>
      </Field.Root>
    </Form>
  ),
  'checkbox group with a parent checkbox': () => (
    <Field.Root name="fruits">
      <CheckboxGroup defaultValue={['apple']} allValues={fruits}>
        <Field.Label>
          <Checkbox.Root parent>
            <Checkbox.Indicator />
          </Checkbox.Root>
          All
        </Field.Label>
        {fruits.map((fruit) => (
          <Field.Item>
            <Field.Label>
              <Checkbox.Root value={fruit}>
                <Checkbox.Indicator />
              </Checkbox.Root>
              {fruit}
            </Field.Label>
          </Field.Item>
        ))}
      </CheckboxGroup>
    </Field.Root>
  ),
  'field-wrapped range slider with a label': () => (
    <Field.Root name="range">
      <Slider.Root defaultValue={[20, 80]}>
        <Slider.Label>Range</Slider.Label>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb index={0} />
            <Slider.Thumb index={1} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </Field.Root>
  ),
  'inset slider thumb before hydration': () => (
    <Slider.Root defaultValue={40} thumbAlignment="edge">
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  ),
  'field-wrapped number field': () => (
    <Field.Root name="quantity">
      <Field.Label>Quantity</Field.Label>
      <NumberField.Root defaultValue={5} min={0} max={10}>
        <NumberField.ScrubArea>
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
        <NumberField.Group>
          <NumberField.Decrement />
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Group>
      </NumberField.Root>
    </Field.Root>
  ),
  'field-wrapped OTP field': () => (
    <Field.Root name="code">
      <Field.Label>Code</Field.Label>
      <OTPField.Root length={4} defaultValue="12">
        <OTPField.Input />
        <OTPField.Input />
        <OTPField.Input />
        <OTPField.Input />
      </OTPField.Root>
      <Field.Error />
    </Field.Root>
  ),
  'avatar with an image and a fallback': () => (
    <Avatar.Root>
      <Avatar.Image src="https://example.com/avatar.png" alt="" />
      <Avatar.Fallback>AB</Avatar.Fallback>
    </Avatar.Root>
  ),
  'scroll area with both scrollbars': () => (
    <ScrollArea.Root>
      <ScrollArea.Viewport>
        <ScrollArea.Content>Content</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  ),
  'toolbar with a toggle group': () => (
    <Toolbar.Root>
      <ToggleGroup defaultValue={['bold']} multiple>
        <Toolbar.Button render={(props) => <Toggle {...props} value="bold" />}>Bold</Toolbar.Button>
        <Toolbar.Button render={(props) => <Toggle {...props} value="italic" />}>Italic</Toolbar.Button>
      </ToggleGroup>
      <Toolbar.Separator />
      <Toolbar.Group>
        <Toolbar.Link href="#">Link</Toolbar.Link>
        <Toolbar.Input defaultValue="text" />
      </Toolbar.Group>
      <Toolbar.Button disabled focusableWhenDisabled>
        Disabled
      </Toolbar.Button>
    </Toolbar.Root>
  ),
  'meter and progress with labels': () => (
    <>
      <Meter.Root value={30}>
        <Meter.Label>Storage</Meter.Label>
        <Meter.Value />
        <Meter.Track>
          <Meter.Indicator />
        </Meter.Track>
      </Meter.Root>
      <Progress.Root value={null}>
        <Progress.Label>Loading</Progress.Label>
        <Progress.Value />
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>
    </>
  ),
  'providers in right-to-left': () => (
    <CSPProvider nonce="abc">
      <DirectionProvider direction="rtl">
        <Separator orientation="vertical" />
        <Slider.Root defaultValue={20}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
        <Tabs.Root defaultValue="a">
          <Tabs.List>
            <Tabs.Tab value="a">A</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      </DirectionProvider>
    </CSPProvider>
  ),
  'anchored toast with an arrow': () => {
    const toast = { id: 'anchored', title: 'Copied', positionerProps: { side: 'bottom' as const } };
    return (
      <Toast.Provider>
        <Toast.Positioner toast={toast}>
          <Toast.Root toast={toast}>
            <Toast.Arrow />
            <Toast.Title />
          </Toast.Root>
        </Toast.Positioner>
      </Toast.Provider>
    );
  },
  'combobox with grouped inline items': () => {
    const groups = [
      { value: 'fruits', items: ['apple', 'banana'] },
      { value: 'vegetables', items: ['carrot'] },
    ];
    return (
      <Combobox.Root items={groups} defaultValue="carrot" inline open>
        <Combobox.Input />
        <Combobox.List>
          {(group: (typeof groups)[number]) => (
            <Combobox.Group items={group.items}>
              <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
              <Combobox.Collection>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.Collection>
            </Combobox.Group>
          )}
        </Combobox.List>
      </Combobox.Root>
    );
  },
  'combobox with an inline grid': () => (
    <Combobox.Root items={fruits} grid inline open multiple defaultValue={['apple']}>
      <Combobox.Input />
      <Combobox.List>
        <Combobox.Row>
          <Combobox.Item value="apple">apple</Combobox.Item>
          <Combobox.Item value="banana">banana</Combobox.Item>
        </Combobox.Row>
        <Combobox.Separator />
        <Combobox.Row>
          <Combobox.Item value="cherry">cherry</Combobox.Item>
        </Combobox.Row>
      </Combobox.List>
    </Combobox.Root>
  ),
  'autocomplete with inline completion inside a field': () => (
    <Field.Root name="search">
      <Field.Label>Search</Field.Label>
      <Autocomplete.Root items={fruits} mode="both" defaultValue="b" autoHighlight inline open>
        <Autocomplete.InputGroup>
          <Autocomplete.Input />
          <Autocomplete.Clear />
          <Autocomplete.Trigger />
        </Autocomplete.InputGroup>
        <Autocomplete.Status />
        <Autocomplete.Empty>Nothing</Autocomplete.Empty>
        <Autocomplete.List>
          {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
        </Autocomplete.List>
      </Autocomplete.Root>
    </Field.Root>
  ),
  'filterable menu open by default': () => (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
    </Menu.FilterProvider>
  ),
  'tooltip and preview card with detached triggers': () => {
    const tooltip = Tooltip.createHandle<string>();
    const card = PreviewCard.createHandle<string>();
    return (
      <Tooltip.Provider delay={0}>
        <Tooltip.Trigger handle={tooltip} payload="a">
          A
        </Tooltip.Trigger>
        <Tooltip.Root handle={tooltip} defaultOpen>
          {({ payload }) => (
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>{payload}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
        <PreviewCard.Trigger handle={card} payload="b" href="#">
          B
        </PreviewCard.Trigger>
        <PreviewCard.Root handle={card} defaultOpen>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Card</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      </Tooltip.Provider>
    );
  },
  'dialogs with detached triggers': () => {
    const dialog = Dialog.createHandle();
    const alert = AlertDialog.createHandle();
    const drawer = Drawer.createHandle();
    return (
      <>
        <Dialog.Trigger handle={dialog}>Dialog</Dialog.Trigger>
        <Dialog.Root handle={dialog} defaultOpen modal="trap-focus">
          <Dialog.Portal>
            <Dialog.Popup>Dialog</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <AlertDialog.Trigger handle={alert}>Alert</AlertDialog.Trigger>
        <AlertDialog.Root handle={alert} defaultOpen>
          <AlertDialog.Portal>
            <AlertDialog.Popup>Alert</AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
        <Drawer.Trigger handle={drawer}>Drawer</Drawer.Trigger>
        <Drawer.Root handle={drawer} defaultOpen>
          <Drawer.Portal>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Portal>
        </Drawer.Root>
      </>
    );
  },
  'nested drawers': () => (
    <Drawer.Provider>
      <Drawer.Indent>
        <Drawer.Root defaultOpen>
          <Drawer.Portal>
            <Drawer.Popup>
              <Drawer.Root defaultOpen>
                <Drawer.Trigger>Nested</Drawer.Trigger>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Indent>
    </Drawer.Provider>
  ),
  'nested navigation menu': () => (
    <NavigationMenu.Root value="outer">
      <NavigationMenu.List>
        <NavigationMenu.Item value="outer">
          <NavigationMenu.Trigger>Outer</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Root orientation="vertical" defaultValue="inner">
              <NavigationMenu.List>
                <NavigationMenu.Item value="inner">
                  <NavigationMenu.Trigger>Inner</NavigationMenu.Trigger>
                  <NavigationMenu.Content>Inner content</NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Viewport />
    </NavigationMenu.Root>
  ),
  'vertical menubar with an open menu': () => (
    <Menubar orientation="vertical" loopFocus={false}>
      <Menu.Root open>
        <Menu.Trigger>File</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
    </Menubar>
  ),
  'context menu inside a menubar-less tree with a submenu': () => (
    <ContextMenu.Root>
      <ContextMenu.Trigger>Area</ContextMenu.Trigger>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Nested trigger</Menu.Trigger>
        <MenuContent />
      </Menu.Root>
    </ContextMenu.Root>
  ),
  'single toggle group and standalone radio group': () => (
    <>
      <ToggleGroup defaultValue={['left']}>
        <Toggle value="left">Left</Toggle>
        <Toggle value="right">Right</Toggle>
      </ToggleGroup>
      <Toggle defaultPressed>Standalone</Toggle>
      <RadioGroup defaultValue="b" disabled>
        <Radio.Root value="a" />
        <Radio.Root value="b">
          <Radio.Indicator keepMounted />
        </Radio.Root>
      </RadioGroup>
    </>
  ),
  'field with a custom validator and validity': () => (
    <Form validationMode="onChange">
      <Field.Root
        name="username"
        validate={(value) => (value === 'admin' ? 'Reserved' : null)}
        validationMode="onBlur"
      >
        <Field.Label>Username</Field.Label>
        <Field.Control defaultValue="admin" minlength={3} />
        <Field.Error match="tooShort">Too short</Field.Error>
        <Field.Error />
      </Field.Root>
      <Field.Root name="slider">
        <Field.Label>Volume</Field.Label>
        <Slider.Root defaultValue={30} orientation="vertical">
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>
      <Field.Root name="otp" disabled>
        <OTPField.Root length={2}>
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </Field.Root>
    </Form>
  ),
  'select with groups and a function value': () => (
    <Field.Root name="fruit" invalid>
      <Select.Root defaultValue="apple" modal={false}>
        <Select.Trigger>
          <Select.Value>{(value: string | null) => value ?? 'None'}</Select.Value>
        </Select.Trigger>
        <Select.Portal>
          <Select.Backdrop />
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup>
              <Select.Group>
                <Select.GroupLabel>Fruits</Select.GroupLabel>
                <Select.Item value="apple">Apple</Select.Item>
              </Select.Group>
              <Select.Separator />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </Field.Root>
  ),
  'drawer virtual keyboard provider': () => (
    <Drawer.Root open>
      <Drawer.Trigger>Open</Drawer.Trigger>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Popup>Content</Drawer.Popup>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  ),
  'controlled combobox and autocomplete with filtered items': () => (
    <>
      <Combobox.Root items={fruits} value="apple" inputValue="ap" inline open>
        <Combobox.Input />
        <Combobox.List>
          {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
        </Combobox.List>
      </Combobox.Root>
      <Autocomplete.Root items={fruits} value="ch" inline open>
        <Autocomplete.Input />
        <Autocomplete.List>
          {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
        </Autocomplete.List>
      </Autocomplete.Root>
    </>
  ),
  'toolbar hosting popup triggers and a radio group': () => (
    <Toolbar.Root>
      <Menu.Root>
        <Toolbar.Button render={(props) => <Menu.Trigger {...props} />}>Menu</Toolbar.Button>
        <MenuContent />
      </Menu.Root>
      <Popover.Root defaultOpen>
        <Toolbar.Button render={(props) => <Popover.Trigger {...props} />}>Popover</Toolbar.Button>
      </Popover.Root>
      <RadioGroup defaultValue="a">
        <Toolbar.Button render={(props) => <Radio.Root {...props} value="a" />} />
        <Toolbar.Button render={(props) => <Radio.Root {...props} value="b" />} />
      </RadioGroup>
    </Toolbar.Root>
  ),
  'hidden-until-found panels and multiple accordion': () => (
    <>
      <Accordion.Root multiple defaultValue={['a', 'b']} orientation="horizontal">
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound>A</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header>
            <Accordion.Trigger>B</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>B</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="c">
          <Accordion.Header>
            <Accordion.Trigger>C</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound>C</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <Collapsible.Root>
        <Collapsible.Trigger>Find me</Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound>Hidden</Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
  'controlled field controls': () => (
    <Form errors={{ agree: 'Required', quantity: ['Too many'] }}>
      <Field.Root name="agree" dirty touched>
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator keepMounted />
        </Checkbox.Root>
        <Field.Error />
      </Field.Root>
      <Field.Root name="quantity">
        <NumberField.Root value={12} format={{ style: 'currency', currency: 'EUR' }}>
          <NumberField.Input />
        </NumberField.Root>
        <Field.Error />
      </Field.Root>
      <Field.Root name="on">
        <Switch.Root checked readOnly>
          <Switch.Thumb />
        </Switch.Root>
      </Field.Root>
      <Field.Root name="range">
        <Slider.Root value={[10, 20]} min={0} max={50} step={5}>
          <Slider.Value>{(formatted) => formatted.join(' – ')}</Slider.Value>
          <Slider.Control>
            <Slider.Thumb index={0} />
            <Slider.Thumb index={1} />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>
      <Field.Root name="tags">
        <Select.Root items={selectItems} value={['apple']} multiple>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>
      </Field.Root>
    </Form>
  ),
  'tabs without a default value': () => (
    <Tabs.Root>
      <Tabs.List>
        <Tabs.Tab value="first" disabled>
          First
        </Tabs.Tab>
        <Tabs.Tab value="second">Second</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="first">First</Tabs.Panel>
      <Tabs.Panel value="second">Second</Tabs.Panel>
    </Tabs.Root>
  ),
};

describe('server rendering states', () => {
  it.each(Object.entries(cases))('%s renders to a string', (_name, Case) => {
    const html = renderToString(() => <Case />);
    expect(html.length).toBeGreaterThan(0);
  });
});
