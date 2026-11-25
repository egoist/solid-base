/// <reference types="vite/client" />

declare module '*.md' {
  import type { DocModule } from './lib/docs';
  const page: DocModule;
  export default page;
}

declare module 'virtual:docs' {
  import type { DocSection, DocPageEntry } from './lib/docs';
  export const sections: DocSection[];
  export const pages: DocPageEntry[];
}

declare module '*?highlight' {
  const highlighted: { html: string; source: string; lang: string };
  export default highlighted;
}
