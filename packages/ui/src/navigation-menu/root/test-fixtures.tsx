import { Show, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { NavigationMenu } from '..';

// Fixtures of upstream `NavigationMenuRoot.test.tsx`.

export function TestNavigationMenu(
  props: NavigationMenu.Root.Props & {
    keepMountedPortal?: boolean;
  },
) {
  const rootProps = omit(props, 'keepMountedPortal');

  return (
    <NavigationMenu.Root {...rootProps}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
            <NavigationMenu.Link href="#link-4">Link 4</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted={props.keepMountedPortal ?? false}>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestNavigationMenuWithTopLevelLink(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#top-level-link" data-testid="top-level-link">
            Top level link
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestNavigationMenuWithDisabledTrigger(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1" disabled>
            Item 1
          </NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
          </NavigationMenu.Content>
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
  );
}

export function TestNestedNavigationMenu(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link href="#nested-link-1">Nested Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side="right" data-testid="nested-positioner">
                  <NavigationMenu.Popup>
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestNavigationMenuOrientationAttributes() {
  return (
    <NavigationMenu.Root data-testid="top-level-root" defaultValue="item-1" orientation="vertical">
      <NavigationMenu.List data-testid="top-level-list">
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Root
              data-testid="nested-root"
              defaultValue="nested-item-1"
              orientation="vertical"
            >
              <NavigationMenu.List data-testid="nested-list">
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger>Nested Item 1</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#nested-link-1">Nested Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
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
  );
}

export function TestInlineNestedNavigationMenu(
  props: {
    nestedDefaultValue?: string | number | boolean | null;
    nestedItem1Value?: string | number | boolean;
    keepMountedContent?: boolean;
    nestedLinkCloseOnClick?: boolean;
  } = {},
) {
  const nestedDefaultValue = () =>
    'nestedDefaultValue' in props ? props.nestedDefaultValue : 'nested-item-1';
  const nestedItem1Value = () => props.nestedItem1Value ?? 'nested-item-1';
  const keepMountedContent = () => props.keepMountedContent ?? false;
  const nestedRootProps = () => {
    const value = nestedDefaultValue();
    return value == null ? {} : { defaultValue: value };
  };

  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1" keepMounted={keepMountedContent()}>
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Root {...nestedRootProps()}>
              <NavigationMenu.List data-testid="inline-nested-list">
                <NavigationMenu.Item value={nestedItem1Value()}>
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content
                    data-testid="nested-popup-1"
                    keepMounted={keepMountedContent()}
                  >
                    <NavigationMenu.Link
                      href="#nested-link-1"
                      closeOnClick={props.nestedLinkCloseOnClick ?? false}
                    >
                      Nested Link 1
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="nested-item-2">
                  <NavigationMenu.Trigger data-testid="nested-trigger-2">
                    Nested Item 2
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content
                    data-testid="nested-popup-2"
                    keepMounted={keepMountedContent()}
                  >
                    <NavigationMenu.Link href="#nested-link-2">Nested Link 2</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport data-testid="inline-nested-viewport" />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2" keepMounted={keepMountedContent()}>
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestInlineNestedNavigationMenuWithDynamicContent(
  props: { initialContentStage?: number } = {},
) {
  // eslint-disable-next-line solid/reactivity -- read once, like an initial state
  const [contentStage, setContentStage] = createSignal(props.initialContentStage ?? 0);

  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Root defaultValue="nested-item-1">
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <button
                      type="button"
                      data-testid="insert-content"
                      onClick={() => {
                        setContentStage((prev) => Math.min(prev + 1, 2));
                      }}
                    >
                      Insert content
                    </button>
                    <Show when={contentStage() >= 1}>
                      <div data-testid="extra-content">
                        <NavigationMenu.Link href="#nested-link-1">
                          Nested Link 1
                        </NavigationMenu.Link>
                        <NavigationMenu.Link href="#nested-link-2">
                          Nested Link 2
                        </NavigationMenu.Link>
                        <NavigationMenu.Link href="#nested-link-3">
                          Nested Link 3
                        </NavigationMenu.Link>
                      </div>
                    </Show>
                    <Show when={contentStage() >= 2}>
                      <div data-testid="extra-content-2">
                        <NavigationMenu.Link href="#nested-link-4">
                          Nested Link 4
                        </NavigationMenu.Link>
                        <NavigationMenu.Link href="#nested-link-5">
                          Nested Link 5
                        </NavigationMenu.Link>
                      </div>
                    </Show>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestInlineNestedNavigationMenuTabForwardBoundary() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Product</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Root defaultValue="nested-item-2">
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Engineering Leads
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link href="#releases">Releases</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="nested-item-2">
                  <NavigationMenu.Trigger data-testid="nested-trigger-2">
                    Startups
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-2">
                    <NavigationMenu.Link href="#quick-start">Quick start</NavigationMenu.Link>
                    <NavigationMenu.Link href="#menu">Menu</NavigationMenu.Link>
                    <NavigationMenu.Link href="#select" data-testid="nested-last-link">
                      Select
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#learn">Learn link</NavigationMenu.Link>
          </NavigationMenu.Content>
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
  );
}

export function TestInlineNestedNavigationMenuTabFlow() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-product">
            <NavigationMenu.Root defaultValue="developers" orientation="vertical">
              <NavigationMenu.List>
                <NavigationMenu.Item value="developers">
                  <NavigationMenu.Trigger data-testid="nested-trigger-developers">
                    Developers
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-developers">
                    <NavigationMenu.Link href="#get-started" data-testid="nested-link-get-started">
                      Get started
                    </NavigationMenu.Link>
                    <NavigationMenu.Link href="#composition" data-testid="nested-link-composition">
                      Composition
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="design-systems">
                  <NavigationMenu.Trigger data-testid="nested-trigger-design-systems">
                    Design Systems
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-design-systems">
                    <NavigationMenu.Link
                      href="#styling"
                      data-testid="nested-link-design-systems-styling"
                    >
                      Styling
                    </NavigationMenu.Link>
                    <NavigationMenu.Link href="#accessibility">Accessibility</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="engineering-leads">
                  <NavigationMenu.Trigger>Engineering Leads</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#releases">Releases</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="#learn">Learn link</NavigationMenu.Link>
          </NavigationMenu.Content>
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
  );
}

export function TestNavigationMenuWithKeepMountedContent() {
  return (
    <NavigationMenu.Root defaultValue="item-1">
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: '675px', height: '220px' }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: '500px', height: '180px' }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestNavigationMenuWithKeepMountedContentClosed() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: '675px', height: '220px' }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: '500px', height: '180px' }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function TestDeeplyNestedNavigationMenu() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="content-1">
            <NavigationMenu.Link href="#link-1" data-testid="link-1">
              Link 1
            </NavigationMenu.Link>
            {/* Level 2 */}
            <NavigationMenu.Root defaultValue="level2-item-1">
              <NavigationMenu.List>
                <NavigationMenu.Item value="level2-item-1">
                  <NavigationMenu.Trigger data-testid="level2-trigger-1">
                    Level 2 Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="level2-content-1">
                    <NavigationMenu.Link href="#level2-link-1" data-testid="level2-link-1">
                      Level 2 Link 1
                    </NavigationMenu.Link>
                    {/* Level 3 */}
                    <NavigationMenu.Root defaultValue="level3-item-1">
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="level3-item-1">
                          <NavigationMenu.Trigger data-testid="level3-trigger-1">
                            Level 3 Item 1
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content data-testid="level3-content-1">
                            <NavigationMenu.Link href="#level3-link-1">
                              Level 3 Link 1
                            </NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                        <NavigationMenu.Item value="level3-item-2">
                          <NavigationMenu.Trigger data-testid="level3-trigger-2">
                            Level 3 Item 2
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content data-testid="level3-content-2">
                            <NavigationMenu.Link href="#level3-link-2">
                              Level 3 Link 2
                            </NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                      <NavigationMenu.Viewport />
                    </NavigationMenu.Root>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="level2-item-2">
                  <NavigationMenu.Trigger data-testid="level2-trigger-2">
                    Level 2 Item 2
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="level2-content-2">
                    <NavigationMenu.Link href="#level2-link-2">Level 2 Link 2</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
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
  );
}

export function TestNestedNavigationMenuWithCloseOnClick(props: {
  onValueChange?: NavigationMenu.Root.Props['onValueChange'];
}) {
  return (
    <NavigationMenu.Root onValueChange={props.onValueChange}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1" closeOnClick>
              Link 1
            </NavigationMenu.Link>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link
                      href="#nested-link-1"
                      closeOnClick
                      data-testid="nested-link-1"
                    >
                      Nested Link 1
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side="right">
                  <NavigationMenu.Popup>
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
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
  );
}

export function TestDeeplyNestedNavigationMenuWithCloseOnClick() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="content-1">
            <NavigationMenu.Root defaultValue="level2-item-1">
              <NavigationMenu.List>
                <NavigationMenu.Item value="level2-item-1">
                  <NavigationMenu.Trigger data-testid="level2-trigger-1">
                    Level 2 Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="level2-content-1">
                    <NavigationMenu.Root defaultValue="level3-item-1">
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="level3-item-1">
                          <NavigationMenu.Trigger data-testid="level3-trigger-1">
                            Level 3 Item 1
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content data-testid="level3-content-1">
                            <NavigationMenu.Link
                              href="#level3-link-1"
                              closeOnClick
                              data-testid="level3-link-1"
                            >
                              Level 3 Link 1
                            </NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                      <NavigationMenu.Viewport />
                    </NavigationMenu.Root>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
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
  );
}

export function TestNavigationMenuWithNestedPopup(props: { children: JSX.Element }) {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">{props.children}</NavigationMenu.Content>
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
  );
}

export function TestNavigationMenuWithTopLevelLinkScopedPopupAnimation() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content class="test-navigation-menu-content">
            <div style={{ width: '675px', height: '220px' }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link href="#top-level-link" data-testid="top-level-link">
            Top level link
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content class="test-navigation-menu-content">
            <div style={{ width: '500px', height: '180px' }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup class="test-navigation-menu-popup" data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export function mockBoundingClientRect(
  element: Element,
  rect: { x: number; y: number; width: number; height: number },
) {
  const domRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => ({}),
  };

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => domRect,
  });
}

type MockAnimation = {
  finished: Promise<void>;
  resolveFinished: (() => void) | null;
};

export function mockAnimations(element: HTMLElement) {
  function createAnimation(): MockAnimation {
    const animation: MockAnimation = {
      finished: Promise.resolve(),
      resolveFinished: null,
    };
    animation.finished = new Promise<void>((resolve) => {
      animation.resolveFinished = resolve;
    });
    return animation;
  }

  let currentAnimation = createAnimation();
  let activeAnimations: MockAnimation[] = [];

  Object.defineProperty(element, 'getAnimations', {
    configurable: true,
    value: () =>
      activeAnimations.map((animation) => ({
        finished: animation.finished,
      })),
  });

  return {
    start() {
      currentAnimation = createAnimation();
      activeAnimations.push(currentAnimation);
      return currentAnimation;
    },
    finish(animation: MockAnimation = currentAnimation) {
      const finished = animation.finished;
      animation.resolveFinished?.();
      animation.resolveFinished = null;
      activeAnimations = activeAnimations.filter((item) => item !== animation);
      return finished;
    },
  };
}

export function mockResizeObserver() {
  const originalResizeObserver = globalThis.ResizeObserver;

  globalThis.ResizeObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;

  return () => {
    globalThis.ResizeObserver = originalResizeObserver;
  };
}

export function primeOpenPopupSize(
  popupRoot: HTMLElement,
  positioner: HTMLElement,
  width: number,
  height: number,
) {
  popupRoot.style.setProperty('--popup-width', 'auto');
  popupRoot.style.setProperty('--popup-height', 'auto');
  positioner.style.setProperty('--positioner-width', `${width}px`);
  positioner.style.setProperty('--positioner-height', `${height}px`);
}

export function getPopupSizeVars(popupRoot: HTMLElement, positioner: HTMLElement) {
  return {
    popupWidth: popupRoot.style.getPropertyValue('--popup-width'),
    popupHeight: popupRoot.style.getPropertyValue('--popup-height'),
    positionerWidth: positioner.style.getPropertyValue('--positioner-width'),
    positionerHeight: positioner.style.getPropertyValue('--positioner-height'),
  };
}
