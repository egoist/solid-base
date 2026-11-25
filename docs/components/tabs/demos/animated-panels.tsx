import { Tabs } from '@egoist/solid-base/tabs';
import styles from './tabs.module.css';
import animated from './animated-panels.module.css';

export default function ExampleAnimatedTabs() {
  return (
    <Tabs.Root class={styles.Tabs} defaultValue="overview">
      <Tabs.List class={styles.List}>
        <Tabs.Tab class={styles.Tab} value="overview">
          Overview
        </Tabs.Tab>
        <Tabs.Tab class={styles.Tab} value="projects">
          Projects
        </Tabs.Tab>
        <Tabs.Tab class={styles.Tab} value="account">
          Account
        </Tabs.Tab>
        <Tabs.Indicator class={styles.Indicator} />
      </Tabs.List>
      <div class={animated.PanelViewport}>
        <Tabs.Panel class={[styles.Panel, animated.Panel]} value="overview">
          <p class={styles.Paragraph}>Workspace stats and activity.</p>
        </Tabs.Panel>
        <Tabs.Panel class={[styles.Panel, animated.Panel]} value="projects">
          <p class={styles.Paragraph}>Milestones and deadlines.</p>
        </Tabs.Panel>
        <Tabs.Panel class={[styles.Panel, animated.Panel]} value="account">
          <p class={styles.Paragraph}>Profile and preferences.</p>
        </Tabs.Panel>
      </div>
    </Tabs.Root>
  );
}
