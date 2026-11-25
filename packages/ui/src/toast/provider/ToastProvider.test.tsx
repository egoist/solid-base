import { createEffect } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { Toast } from '..';
import { useToastProviderContext } from './ToastProviderContext';
import { createClock, flushMicrotasks, renderWithProps } from '../utils/test-utils';

describe('<Toast.Provider />', () => {
  const clock = createClock();

  clock.withFakeTimers();

  it('syncs a changed timeout before descendant effects', async () => {
    const onClose = vi.fn();

    function AddToastInEffect(props: { active: boolean }) {
      const { add } = Toast.useToastManager();

      createEffect(
        () => props.active,
        (active) => {
          if (active) {
            add({ id: 'toast', title: 'Toast', onClose });
          }
        },
      );

      return null;
    }

    function App(props: { timeout: number; addToast: boolean }) {
      return (
        <Toast.Provider timeout={props.timeout}>
          <AddToastInEffect active={props.addToast} />
        </Toast.Provider>
      );
    }

    const { setProps } = renderWithProps(App, { timeout: 5000, addToast: false });

    await setProps({ timeout: 1000, addToast: true });

    clock.tick(999);
    await flushMicrotasks();
    expect(onClose).not.toHaveBeenCalled();

    clock.tick(2);
    await flushMicrotasks();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('syncs a changed limit before descendant effects', async () => {
    const observeToasts = vi.fn();

    function AddToastsInEffect(props: { active: boolean }) {
      const { add } = Toast.useToastManager();

      createEffect(
        () => props.active,
        (active) => {
          if (active) {
            add({ id: 'first', title: 'First', timeout: 0 });
            add({ id: 'second', title: 'Second', timeout: 0 });
          }
        },
      );

      return null;
    }

    function ObserveToastsInEffect(props: { active: boolean }) {
      const store = useToastProviderContext();

      createEffect(
        () => props.active,
        (active) => {
          if (active) {
            observeToasts(
              store.state.toasts.map((toast) => ({
                id: toast.id,
                limited: toast.limited,
              })),
            );
          }
        },
      );

      return null;
    }

    function App(props: { limit: number; runEffects: boolean }) {
      return (
        <Toast.Provider limit={props.limit}>
          <AddToastsInEffect active={props.runEffects} />
          <ObserveToastsInEffect active={props.runEffects} />
        </Toast.Provider>
      );
    }

    const { setProps } = renderWithProps(App, { limit: 3, runEffects: false });

    await setProps({ limit: 1, runEffects: true });

    expect(observeToasts).toHaveBeenCalledWith([
      { id: 'second', limited: false },
      { id: 'first', limited: true },
    ]);
  });

  it('stops the auto-dismiss timers when the provider is disposed', async () => {
    const onClose = vi.fn();
    const toastManager = Toast.createToastManager();

    function App(props: { mounted: boolean }) {
      return (
        <>
          {props.mounted ? <Toast.Provider toastManager={toastManager} /> : null}
        </>
      );
    }

    const { setProps } = renderWithProps(App, { mounted: true });
    toastManager.add({ title: 'Toast', timeout: 1000, onClose });

    clock.tick(400);
    await setProps({ mounted: false });

    clock.tick(5000);
    await flushMicrotasks();
    expect(onClose).not.toHaveBeenCalled();
  });

  // Not ported: "does not sync provider props from an abandoned render" and the
  // `React.Activity` suite rely on React-specific rendering (Suspense transitions, Activity).
});
