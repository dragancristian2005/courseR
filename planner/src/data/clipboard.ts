import * as Clipboard from 'expo-clipboard';

/** Copies text to the system clipboard; false when the platform refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/** Reads the system clipboard as text; null when the platform refuses (permission denied). */
export async function readText(): Promise<string | null> {
  try {
    return await Clipboard.getStringAsync();
  } catch {
    return null;
  }
}
