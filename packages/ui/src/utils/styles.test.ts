import { afterEach, expect, test } from 'vitest';
import { styleDisableScrollbar } from './styles';

const selector = 'style[data-base-ui-disable-scrollbar]';

afterEach(() => {
  document.head.querySelectorAll(selector).forEach((style) => style.remove());
  document.body.innerHTML = '';
});

test('injects the stylesheet into the document head once', () => {
  const element = document.createElement('div');
  document.body.appendChild(element);

  styleDisableScrollbar.inject(element, 'abc');
  styleDisableScrollbar.inject(element);

  const styles = document.head.querySelectorAll<HTMLStyleElement>(selector);
  expect(styles).toHaveLength(1);
  expect(styles[0].nonce).toBe('abc');
});

test('injects the stylesheet into the shadow root that contains the element', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadowRoot = host.attachShadow({ mode: 'closed' });
  const element = document.createElement('div');
  shadowRoot.appendChild(element);

  styleDisableScrollbar.inject(element);
  styleDisableScrollbar.inject(element);

  expect(shadowRoot.querySelectorAll(selector)).toHaveLength(1);
  expect(document.head.querySelector(selector)).toBe(null);
});
