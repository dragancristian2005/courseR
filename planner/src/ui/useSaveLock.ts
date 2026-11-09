import { useRef, useState } from 'react';

/**
 * Guards a screen's Save against double taps. The lock stays on after a successful save (the
 * screen navigates away); a failure releases it and sets `failed` so the user can retry.
 */
export function useSaveLock() {
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (job: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await job();
    } catch {
      setFailed(true);
      lock.current = false;
      setSaving(false);
    }
  };
  return { saving, failed, run };
}
