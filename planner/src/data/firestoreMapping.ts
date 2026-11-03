import type { Base } from '../domain/types';

/** Firestore document body for a record. The id lives in the doc path, and undefined fields are dropped (Firestore rejects them). */
export function toDoc<T extends Base>(record: T): Record<string, unknown> {
  const doc: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'id' || value === undefined) continue;
    doc[key] = value;
  }
  return doc;
}

export function fromDoc<T extends Base = Base>(id: string, doc: Record<string, unknown>): T {
  return { ...doc, id } as unknown as T;
}
