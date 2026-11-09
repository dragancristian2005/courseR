import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time, refreshed every 60 seconds and when the app comes back to the foreground. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const id = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // Installed web apps are suspended without an AppState change, so listen for visibility too.
    const doc = typeof document !== 'undefined' ? document : undefined;
    const onVisible = () => {
      if (doc?.visibilityState !== 'hidden') refresh();
    };
    doc?.addEventListener?.('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      sub.remove();
      doc?.removeEventListener?.('visibilitychange', onVisible);
    };
  }, []);
  return now;
}
