import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Autocomplete } from '@egoist/solid-base/autocomplete';
import styles from './fuzzy-matching.module.css';

export default function ExampleFuzzyMatchingAutocomplete() {
  return (
    <Autocomplete.Root
      items={fuzzyItems}
      filter={fuzzyFilter}
      itemToStringValue={(item) => item.title}
    >
      <label class={styles.Label}>
        Fuzzy search documentation
        <Autocomplete.Input placeholder="e.g. React" class={styles.Input} />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner class={styles.Positioner} sideOffset={4}>
          <Autocomplete.Popup class={styles.Popup}>
            <Autocomplete.Empty>
              <div class={styles.Empty}>
                No results found for "<Autocomplete.Value />"
              </div>
            </Autocomplete.Empty>

            <Autocomplete.List class={styles.List}>
              {(item: FuzzyItem) => (
                <Autocomplete.Item value={item} class={styles.Item}>
                  <Autocomplete.Value>
                    {(value) => (
                      <span class={styles.ItemContent}>
                        <span class={styles.ItemHeader}>
                          <span class={styles.ItemTitle}>{highlightText(item.title, value)}</span>
                        </span>
                        <span class={styles.ItemDescription}>
                          {highlightText(item.description, value)}
                        </span>
                      </span>
                    )}
                  </Autocomplete.Value>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function highlightText(text: string, query: string): JSX.Element {
  const trimmed = query.trim();
  if (!trimmed) {
    return text;
  }

  const escaped = trimmed.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // With a capturing group, `split` puts the matches at the odd indexes.
  const parts = text
    .split(new RegExp(`(${escaped})`, 'gi'))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }));

  return <For each={parts}>{(part) => (part.match ? <mark>{part.text}</mark> : part.text)}</For>;
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Whether every character of the query appears in the text, in order. */
function fuzzyMatch(text: string, query: string) {
  const haystack = normalize(text);
  const needle = normalize(query).replace(/\s+/g, '');
  let position = 0;
  for (const char of needle) {
    position = haystack.indexOf(char, position);
    if (position === -1) {
      return false;
    }
    position += 1;
  }
  return true;
}

function fuzzyFilter(item: FuzzyItem, query: string): boolean {
  if (!query) {
    return true;
  }

  return (
    fuzzyMatch(item.title, query) ||
    fuzzyMatch(item.category, query) ||
    normalize(item.description).includes(normalize(query))
  );
}

interface FuzzyItem {
  title: string;
  description: string;
  category: string;
}

const fuzzyItems: FuzzyItem[] = [
  {
    title: 'React Hooks Guide',
    description: 'Learn how to use React Hooks like useState, useEffect, and custom hooks',
    category: 'React',
  },
  {
    title: 'JavaScript Array Methods',
    description: 'Master array methods like map, filter, reduce, and forEach in JavaScript',
    category: 'JavaScript',
  },
  {
    title: 'CSS Flexbox Layout',
    description: 'Complete guide to CSS Flexbox for responsive web design',
    category: 'CSS',
  },
  {
    title: 'TypeScript Interfaces',
    description: 'Understanding TypeScript interfaces and type definitions',
    category: 'TypeScript',
  },
  {
    title: 'React Performance Optimization',
    description: 'Tips and techniques for optimizing React application performance',
    category: 'React',
  },
  {
    title: 'HTML Semantic Elements',
    description: 'Using semantic HTML elements for better accessibility and SEO',
    category: 'HTML',
  },
  {
    title: 'Node.js Express Server',
    description: 'Building RESTful APIs with Node.js and Express framework',
    category: 'Node.js',
  },
  {
    title: 'Vue Composition API',
    description: 'Modern Vue.js development using the Composition API',
    category: 'Vue.js',
  },
  {
    title: 'Angular Components',
    description: 'Creating reusable Angular components with TypeScript',
    category: 'Angular',
  },
  {
    title: 'Python Django Framework',
    description: 'Web development with Python Django framework',
    category: 'Python',
  },
  {
    title: 'CSS Grid Layout',
    description: 'Advanced CSS Grid techniques for complex layouts',
    category: 'CSS',
  },
  {
    title: 'React Testing Library',
    description: 'Testing React components with React Testing Library',
    category: 'React',
  },
  {
    title: 'MongoDB Queries',
    description: 'Advanced MongoDB queries and aggregation pipelines',
    category: 'Database',
  },
  {
    title: 'Webpack Configuration',
    description: 'Optimizing webpack configuration for production builds',
    category: 'Build Tools',
  },
  {
    title: 'SASS/SCSS Guide',
    description: 'Writing maintainable CSS with SASS and SCSS',
    category: 'CSS',
  },
];
