import { isDate } from './dates';
import { isSafeLinkUrl } from './links';
import type { PlannerData } from './types';

const NOT_BACKUP = 'This file is not a Study Planner backup.';
const NEWER = 'This backup was made by a newer version of the app.';
const UNREADABLE = 'This file could not be read.';

const LIST_KEYS = [
  'subjects',
  'patterns',
  'overrides',
  'exams',
  'homework',
  'notes',
  'links',
] as const;

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

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    ID_PATTERN.test(v.id) &&
    typeof v.updatedAt === 'number' &&
    Number.isFinite(v.updatedAt)
  );
}

function isDateString(v: unknown): boolean {
  return typeof v === 'string' && isDate(v);
}

function isSemester(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (!isDateString(v.firstDay) || !isDateString(v.lastDay)) return false;
  if (!Array.isArray(v.breaks)) return false;
  if (!v.breaks.every((b) => isObject(b) && isDateString(b.from) && isDateString(b.to))) {
    return false;
  }
  return (
    isObject(v.parityOverrides) &&
    Object.values(v.parityOverrides).every((p) => p === 'odd' || p === 'even')
  );
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
  if (data.semester !== null && !isSemester(data.semester)) return { ok: false, error: NOT_BACKUP };
  for (const key of LIST_KEYS) {
    const list = data[key];
    if (!Array.isArray(list) || !list.every(isRecord)) return { ok: false, error: NOT_BACKUP };
  }
  const links = data.links as unknown[];
  if (!links.every((l) => isObject(l) && typeof l.url === 'string' && isSafeLinkUrl(l.url))) {
    return { ok: false, error: NOT_BACKUP };
  }
  return { ok: true, data: data as unknown as PlannerData };
}
