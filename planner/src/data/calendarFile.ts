import { Platform } from 'react-native';

export type CalendarDelivery = 'opened' | 'shared' | 'downloaded' | 'cancelled' | 'unsupported';

const MIME = 'text/calendar;charset=utf-8';

function isIosWeb(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function download(ics: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Some browsers lose the download if the URL is revoked straight away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Adds the calendar to the device. On iPhone and iPad (web) it opens the file so Safari shows the
 * Calendar "Add All" view; elsewhere it downloads the file. Nothing is awaited before the
 * navigation or click, so the browser still counts it as a tap. Native apps arrive with Phase 4.
 */
export function openCalendarFile(ics: string, filename: string): CalendarDelivery {
  if (Platform.OS !== 'web') return 'unsupported';
  if (isIosWeb()) {
    window.location.href = URL.createObjectURL(new Blob([ics], { type: MIME }));
    return 'opened';
  }
  download(ics, filename);
  return 'downloaded';
}

/** Saves the file: the share sheet where the browser can share files, otherwise a download. */
export async function shareCalendarFile(ics: string, filename: string): Promise<CalendarDelivery> {
  if (Platform.OS !== 'web') return 'unsupported';
  if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([ics], filename, { type: MIME });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
        // Any other failure: fall back to a plain download.
      }
    }
  }
  download(ics, filename);
  return 'downloaded';
}
