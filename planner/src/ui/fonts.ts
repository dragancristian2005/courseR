/**
 * The app can start once its fonts have loaded or failed. A failed font (e.g. a slow phone
 * hitting expo-font's timeout) falls back to the system font instead of crashing the app.
 */
export function fontsSettled(loaded: boolean, error: Error | null): boolean {
  return loaded || error !== null;
}
