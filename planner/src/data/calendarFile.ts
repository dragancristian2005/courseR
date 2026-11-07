import { Platform } from 'react-native';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'unsupported';

function download(ics: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
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
 * Hands the calendar file to the device: the share sheet where the browser can share files (on
 * iPhone it offers Calendar and Files), otherwise a download. Native apps arrive with Phase 4.
 */
export async function saveCalendarFile(ics: string, filename: string): Promise<SaveResult> {
  if (Platform.OS !== 'web') return 'unsupported';
  if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([ics], filename, { type: 'text/calendar' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Study Planner' });
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
