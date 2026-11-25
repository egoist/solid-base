import { For } from 'solid-js';
import { Accordion } from '@egoist/solid-base/accordion';
import styles from './accordion.module.css';

const faq = [
  {
    question: 'How long does shipping take?',
    answer:
      'Standard shipping takes 3–5 business days. Express delivery arrives in 1–2 business days.',
  },
  {
    question: 'What is your return policy?',
    answer:
      'You can return any item within 30 days of delivery. Opened items may be subject to a 10% restocking fee.',
  },
  {
    question: 'Do you ship internationally?',
    answer:
      'Yes, we ship to over 40 countries. International orders typically arrive within 7–14 business days.',
  },
  {
    question: 'How can I track my order?',
    answer:
      'Once your order ships, you’ll receive a tracking link by email. Tracking updates can take up to 24 hours to appear.',
  },
];

export default function ExampleAccordionHiddenUntilFound() {
  return (
    <Accordion.Root class={styles.Accordion} hiddenUntilFound>
      <For each={faq}>
        {(entry) => (
          <Accordion.Item class={styles.Item}>
            <Accordion.Header class={styles.Header}>
              <Accordion.Trigger class={styles.Trigger}>
                {entry.question}
                <PlusIcon class={styles.Icon} />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel class={styles.Panel}>
              <div class={styles.Content}>{entry.answer}</div>
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </For>
    </Accordion.Root>
  );
}

function PlusIcon(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="square"
      aria-hidden="true"
    >
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}
