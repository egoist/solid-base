import { For, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Link } from '@tanstack/solid-router';
import { Switch } from '@egoist/solid-base/switch';
import { Slider } from '@egoist/solid-base/slider';
import { ToggleGroup } from '@egoist/solid-base/toggle-group';
import { Toggle } from '@egoist/solid-base/toggle';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { Progress } from '@egoist/solid-base/progress';
import { Tabs } from '@egoist/solid-base/tabs';
import { NumberField } from '@egoist/solid-base/number-field';
import { pagesIn } from '../lib/docs';
import {
  ArrowUpRightIcon,
  BlocksIcon,
  BookIcon,
  CheckCircleIcon,
  GitHubIcon,
  RocketIcon,
} from './icons';
import { DocLink } from './DocLink';
import { REPOSITORY_URL } from './Header';
import renderSnippet from '../snippets/render.tsx?highlight';
import stylingSnippet from '../snippets/styling.css?highlight';

const components = pagesIn('components');

export function Home() {
  return (
    <main id="main" class="home">
      <section class="band hero">
        <div class="hero-copy">
          <p class="eyebrow hero-kicker">
            Base UI <span aria-hidden="true">×</span> SolidJS 2
          </p>
          <h1 class="display hero-title">
            Unstyled components.
            <br />
            Finely reactive.
          </h1>
          <p class="hero-lede">
            Accessible, headless building blocks for Solid. Every part, prop and interaction of Base
            UI, rebuilt on signals. You bring the styles.
          </p>
          <div class="hero-actions">
            <DocLink class="button" data-variant="primary" route="/overview/quick-start">
              Get Started
            </DocLink>
            <a class="button" href={REPOSITORY_URL}>
              View on GitHub
            </a>
            <DocLink class="button" route="/handbook/styling">
              Read the Handbook
            </DocLink>
          </div>
        </div>
        <div class="hero-art">
          <Art>
            <HeroWindow />
          </Art>
        </div>
      </section>

      <section class="band intro">
        <p class="eyebrow">@egoist/solid-base</p>
        <h2 class="display intro-title">Every Base UI part, on signals</h2>
        <p class="intro-lede">
          {components.length} components with the same parts, props, data attributes and keyboard
          behavior as upstream — written for Solid 2, not translated from React.
        </p>
      </section>

      <section class="band feature-grid">
        <Feature
          icon={<BlocksIcon />}
          title="Accessible by default"
          lede="Focus management, keyboard navigation and screen reader semantics come built in."
          points={[
            'Roving focus, typeahead and dismissal',
            'Focus traps, return focus and scroll locking',
            'RTL, labels and form validation',
          ]}
          link={{ route: '/overview/accessibility', label: 'Accessibility' }}
        />
        <div class="feature-art">
          <Art>
            <SettingsWindow />
          </Art>
        </div>

        <div class="feature-art">
          <Art>
            <CodeWindow />
          </Art>
        </div>
        <Feature
          icon={<RocketIcon />}
          title="Native to Solid 2"
          lede="Live props and state, accessors and createX primitives. No virtual DOM, no re-renders."
          points={[
            'A render prop that runs once',
            'State as data attributes for styling',
            'Server rendering and hydration',
          ]}
          link={{ route: '/handbook/composition', label: 'Composition' }}
        />
      </section>

      <section class="band theme-light light-band">
        <div class="intro">
          <p class="eyebrow">Handbook</p>
          <h2 class="display intro-title">Styled by you, end to end</h2>
          <p class="intro-lede">
            No CSS ships with the components. Use plain CSS, modules or utility classes against data
            attributes and CSS variables.
          </p>
        </div>
        <div class="feature-grid">
          <Feature
            icon={<BookIcon />}
            title="Style with any tool"
            lede="Pass a class or a function of the component's state, then target state attributes."
            points={['[data-checked], [data-open], [data-highlighted]', 'CSS variables for sizes and positions', 'Enter and exit transitions']}
            link={{ route: '/handbook/styling', label: 'Styling' }}
          />
          <div class="feature-art feature-art-light">
            <StylePreview />
          </div>
        </div>
      </section>

      <section class="band catalog">
        <div class="catalog-header">
          <p class="eyebrow">Components</p>
          <h2 class="display intro-title">The full set</h2>
        </div>
        <ul class="catalog-grid">
          <For each={components}>
            {(page) => (
              <li>
                <DocLink route={page.route} class="catalog-card">
                  <span class="catalog-title">{page.frontmatter.title}</span>
                  <span class="catalog-description">{page.frontmatter.description}</span>
                </DocLink>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="band cta">
        <h2 class="display cta-title">Build with Solid. Style it yourself.</h2>
        <p class="cta-lede">
          Accessible primitives, finely reactive,
          <br />
          and entirely yours to design.
        </p>
        <DocLink class="button" data-variant="solid" route="/overview/quick-start">
          Get Started
        </DocLink>
      </section>

      <footer class="band site-footer">
        <div class="footer-columns">
          <div>
            <p class="eyebrow">Docs</p>
            <DocLink route="/overview/quick-start">Quick start</DocLink>
            <DocLink route="/handbook/styling">Handbook</DocLink>
            <DocLink route="/components/accordion">Components</DocLink>
            <DocLink route="/utils/merge-props">Utilities</DocLink>
          </div>
          <div>
            <p class="eyebrow">Upstream</p>
            <a href="https://base-ui.com">Base UI</a>
            <a href="https://www.solidjs.com">SolidJS</a>
            <a href="https://tanstack.com/start">TanStack Start</a>
          </div>
          <div class="footer-social">
            <p class="eyebrow">Source</p>
            <a href={REPOSITORY_URL}>
              <GitHubIcon /> GitHub
            </a>
          </div>
        </div>
        <div class="footer-bottom">
          MIT licensed. A port of Base UI by the MUI team.{' '}
          <Link to="/">solid-base</Link>
        </div>
      </footer>
    </main>
  );
}

function Feature(props: {
  icon: JSX.Element;
  title: string;
  lede: string;
  points: string[];
  link: { route: string; label: string };
}) {
  return (
    <div class="feature">
      <span class="feature-icon">{props.icon}</span>
      <h3 class="feature-title">{props.title}</h3>
      <p class="feature-lede">{props.lede}</p>
      <ul class="feature-points">
        <For each={props.points}>
          {(point) => (
            <li>
              <CheckCircleIcon />
              {point}
            </li>
          )}
        </For>
      </ul>
      <DocLink route={props.link.route} class="pill-link feature-link">
        {props.link.label} <ArrowUpRightIcon width="13" height="13" />
      </DocLink>
    </div>
  );
}

/** A gradient "light streak" panel framing a floating window. */
function Art(props: { children: JSX.Element }) {
  return (
    <div class="art">
      <div class="art-noise" aria-hidden="true" />
      {props.children}
    </div>
  );
}

function Window(props: { title: string; children: JSX.Element; class?: string }) {
  return (
    <div class={['window', props.class]}>
      <div class="window-bar">
        <span class="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span class="window-title">{props.title}</span>
      </div>
      {props.children}
    </div>
  );
}

/** Live components in the hero. */
function HeroWindow() {
  const [volume, setVolume] = createSignal(64);
  return (
    <Window title="settings.tsx" class="window-hero">
      <div class="window-body">
        <label class="w-row">
          <span>Notifications</span>
          <Switch.Root defaultChecked class="w-switch">
            <Switch.Thumb class="w-switch-thumb" />
          </Switch.Root>
        </label>
        <label class="w-row">
          <span>Weekly digest</span>
          <Checkbox.Root class="w-checkbox">
            <Checkbox.Indicator class="w-checkbox-indicator">
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" stroke-width="1.8" />
              </svg>
            </Checkbox.Indicator>
          </Checkbox.Root>
        </label>
        <div class="w-row">
          <span>Volume</span>
          <span class="w-value">{volume()}</span>
        </div>
        <Slider.Root value={volume()} onValueChange={(value) => setVolume(value as number)}>
          <Slider.Control class="w-slider">
            <Slider.Track class="w-slider-track">
              <Slider.Indicator class="w-slider-indicator" />
              <Slider.Thumb class="w-slider-thumb" aria-label="Volume" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div class="w-divider" />
        <div class="w-row">
          <span>Alignment</span>
          <ToggleGroup defaultValue={['center']} class="w-toggle-group" aria-label="Alignment">
            <Toggle value="left" class="w-toggle" aria-label="Align left">
              <AlignIcon align="start" />
            </Toggle>
            <Toggle value="center" class="w-toggle" aria-label="Align center">
              <AlignIcon align="center" />
            </Toggle>
            <Toggle value="right" class="w-toggle" aria-label="Align right">
              <AlignIcon align="end" />
            </Toggle>
          </ToggleGroup>
        </div>
        <div class="w-row">
          <span>Font size</span>
          <NumberField.Root defaultValue={14} min={8} max={72} class="w-number">
            <NumberField.Group class="w-number-group">
              <NumberField.Decrement class="w-number-button" aria-label="Smaller">
                −
              </NumberField.Decrement>
              <NumberField.Input class="w-number-input" aria-label="Font size" />
              <NumberField.Increment class="w-number-button" aria-label="Larger">
                +
              </NumberField.Increment>
            </NumberField.Group>
          </NumberField.Root>
        </div>
      </div>
    </Window>
  );
}

function SettingsWindow() {
  return (
    <Window title="tabs.tsx">
      <Tabs.Root defaultValue="keyboard">
        <Tabs.List class="w-tabs-list" aria-label="Accessibility">
          <Tabs.Tab value="keyboard" class="w-tab">
            Keyboard
          </Tabs.Tab>
          <Tabs.Tab value="focus" class="w-tab">
            Focus
          </Tabs.Tab>
          <Tabs.Tab value="aria" class="w-tab">
            ARIA
          </Tabs.Tab>
          <Tabs.Indicator class="w-tab-indicator" />
        </Tabs.List>
        <Tabs.Panel value="keyboard" class="w-tab-panel">
          <p>Arrow keys move between these tabs. Home and End jump to the ends.</p>
          <Progress.Root value={72} class="w-progress">
            <div class="w-row">
              <Progress.Label>Coverage</Progress.Label>
              <Progress.Value class="w-value" />
            </div>
            <Progress.Track class="w-progress-track">
              <Progress.Indicator class="w-progress-indicator" />
            </Progress.Track>
          </Progress.Root>
        </Tabs.Panel>
        <Tabs.Panel value="focus" class="w-tab-panel">
          <p>Popups trap focus and return it to their trigger when they close.</p>
        </Tabs.Panel>
        <Tabs.Panel value="aria" class="w-tab-panel">
          <p>Roles, states and relationships are wired for you: try a screen reader.</p>
        </Tabs.Panel>
      </Tabs.Root>
    </Window>
  );
}

function CodeWindow() {
  return (
    <Tabs.Root defaultValue="tsx" class="window">
      <Tabs.List class="window-bar window-tabs" aria-label="Source files">
        <Tabs.Tab value="tsx" class="window-tab">
          Avatar.tsx
        </Tabs.Tab>
        <Tabs.Tab value="css" class="window-tab">
          switch.css
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="tsx" class="window-code" innerHTML={renderSnippet.html} />
      <Tabs.Panel value="css" class="window-code" innerHTML={stylingSnippet.html} />
    </Tabs.Root>
  );
}

function StylePreview() {
  return (
    <div class="style-preview">
      <div class="style-preview-states">
        <For each={['unchecked', 'checked', 'disabled']}>
          {(state) => (
            <div class="style-preview-state">
              <Switch.Root
                class="w-switch"
                defaultChecked={state === 'checked'}
                disabled={state === 'disabled'}
                aria-label={state}
              >
                <Switch.Thumb class="w-switch-thumb" />
              </Switch.Root>
              <code>[data-{state}]</code>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function AlignIcon(props: { align: 'start' | 'center' | 'end' }) {
  const lines = [16, 10, 14];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <For each={lines}>
        {(width, index) => {
          const x = () =>
            props.align === 'start' ? 0 : props.align === 'end' ? 16 - width : (16 - width) / 2;
          return <rect x={x()} y={2 + index() * 5} width={width} height="2" rx="1" fill="currentColor" />;
        }}
      </For>
    </svg>
  );
}

