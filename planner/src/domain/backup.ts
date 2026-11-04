import type { PlannerData } from './types';

const NOT_BACKUP = 'This file is not a Study Planner backup.';
const NEWER = 'This backup was made by a newer version of the app.';
const UNREADABLE = 'This file could not be read.';

const LIST_KEYS = ['subjects', 'patterns', 'overrides', 'exams', 'homework', 'notes', 'links'] as const;

export type ParseResult = { ok: true; data: PlannerData } | { ok: false; error: string };

export function exportBackup(data: PlannerData, now: Date): string {
  return JSON.stringify(
    { app: 'study-planner', version: 1, exportedAt: now.toISOString(), data },
    null,
    2,
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseBackup(json: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: UNREADABLE };
  }
  if (!isObject(parsed) || parsed.app !== 'study-planner') return { ok: false, error: NOT_BACKUP };
  const { version, data } = parsed;
  if (typeof version === 'number' && version > 1) return { ok: false, error: NEWER };
  if (version !== 1) return { ok: false, error: NOT_BACKUP };
  if (!isObject(data)) return { ok: false, error: NOT_BACKUP };
  if (data.semester !== null && !isObject(data.semester)) return { ok: false, error: NOT_BACKUP };
  for (const key of LIST_KEYS) {
    if (!Array.isArray(data[key])) return { ok: false, error: NOT_BACKUP };
  }
  return { ok: true, data: data as unknown as PlannerData };
}
