import { hydrate } from '@solidjs/web';
import { StartClient, hydrateStart } from '@tanstack/solid-start/client';
import { loadDocModule } from './lib/docs';

// Doc pages hold live demos (functions), which can't be serialized into the HTML: load the
// current page's module before hydrating, so it renders synchronously like on the server.
Promise.all([hydrateStart(), loadDocModule(window.location.pathname)]).then(([router]) => {
  hydrate(() => <StartClient router={router} />, document);
});
