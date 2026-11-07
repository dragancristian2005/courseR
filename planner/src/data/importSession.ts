import type { ImportFile } from '../domain/importFormat';

let pending: ImportFile | null = null;

/** Holds the parsed import between the paste screen and the review screens. Not persisted. */
export function setPending(file: ImportFile): void {
  pending = file;
}

export function getPending(): ImportFile | null {
  return pending;
}

export function clearPending(): void {
  pending = null;
}
