import { Platform } from 'react-native';

const NATIVE_ERROR = 'Backups on this device arrive with the native app.';

/** Saves text as a file download. Web only for now. */
export function downloadText(filename: string, text: string): void {
  if (Platform.OS !== 'web') throw new Error(NATIVE_ERROR);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Lets the user choose a JSON file and returns its text, or null if they cancel. */
export function pickTextFile(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.reject(new Error(NATIVE_ERROR));
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve, reject);
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
