import { Separator } from '@egoist/solid-base/separator';

export const title = 'Separator';

export default function SeparatorDemo() {
  return (
    <div class="row" style={{ height: '24px' }}>
      <span>Home</span>
      <Separator orientation="vertical" style={{ width: '1px', 'align-self': 'stretch', background: 'var(--border)' }} />
      <span>Docs</span>
      <Separator orientation="vertical" style={{ width: '1px', 'align-self': 'stretch', background: 'var(--border)' }} />
      <span>Blog</span>
    </div>
  );
}
