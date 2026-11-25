import { Button } from '../button';

// `on*` handlers receive events with `preventBaseUIHandler()`.
export const a = <Button onClick={(event) => event.preventBaseUIHandler()} />;
// Plain handlers stay assignable.
const handler = (event: MouseEvent) => event.preventDefault();
export const b = <Button onClick={handler} />;
export const c = <Button onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.focus()} />;
