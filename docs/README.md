# solid-base documentation

The Markdown source of the documentation. The website in `../website` renders it (this README
is not published).

```
docs/
  overview/<page>.md            → /overview/<page>
  handbook/<page>.md            → /handbook/<page>
  components/<slug>/index.md    → /components/<slug>
  components/<slug>/demos/*.tsx   live demos (+ *.module.css)
  utils/<slug>/index.md         → /utils/<slug>
```

Run the site with `bun run website` (from the repository root), or build it with
`bun run website:build`: the build prerenders every page and fails on broken links.

## Frontmatter

```yaml
---
title: Switch                 # required
description: A control that…  # one sentence, shown under the title and in search
order: 2                      # optional, sorts overview/handbook pages
---
```

## Directives

- `::demo{src="./demos/hero.tsx"}` — renders the demo live, with tabs showing its source and the
  CSS modules it imports.
- `::api` — the API reference generated from the library's TypeScript source (parts, props,
  defaults, data attributes, CSS variables). Defaults to the module named like the page's folder;
  `::api{module="dialog" parts="Root, Popup"}` picks another module or a subset of parts.
- Callouts: `:::note`, `:::tip`, `:::warning`, `:::solid` (Solid-specific differences), with an
  optional label: `:::note[Controlled state]`.

Code fences are highlighted at build time; add a title with ` ```tsx title="Anatomy" `.

## Writing demos

- One component per file, default-exported. Import from `@egoist/solid-base/<module>`.
- Style with a CSS module next to the demo. Use the site's design tokens so demos match the site
  in dark (default) and light mode:
  - colors: `--paper` (page), `--paper-sunken`, `--surface` (cards, popups), `--surface-raised`,
    `--ink` (text), `--ink-soft`, `--muted`, `--line`, `--line-soft`, `--accent` (indigo-violet),
    `--accent-ink` (text on accent), `--accent-soft`, `--accent-text` (accent-colored text),
    `--danger`, `--success`, `--overlay`, `--gradient` (violet → cyan, for decorative fills)
  - type: `--font-sans` (Inter), `--font-mono`
  - shape and motion: `--radius` (6px), `--radius-lg` (10px), `--shadow`, `--shadow-lg`,
    `--ease`, `--ease-out`
- Visual language (crisp, technical, dark-first): 1px `--line` hairline borders, small radii,
  `--surface` panels, Inter with slightly tight tracking (`letter-spacing: -0.01em`) and medium
  weights, mono for small labels/values, `--accent` for the active/checked/selected state and
  focus rings (`outline: 2px solid var(--accent); outline-offset: 2px`), restrained motion driven
  by `[data-starting-style]` / `[data-ending-style]`. No serif type, no warm/paper colors.
- Write idiomatic Solid 2: `class`, `render="a"` or `render={(props) => <a {...props} />}`,
  signals, `onInput` for text inputs, lowercase attributes.
