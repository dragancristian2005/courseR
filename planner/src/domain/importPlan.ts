import { OPEN_START, stamp } from './edits';
import type { ImportBlock, TimetableImport } from './importFormat';
import type { ClassPattern, ClassType, PlannerData, Subject } from './types';

/** Lowercase, accents stripped, trimmed: "  ȘP " folds to "sp". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Identity of a subject across spellings: folded, with everything but letters and digits removed. */
export function subjectKey(s: string): string {
  return fold(s).replace(/[^\p{L}\p{N}]/gu, '');
}

const RANGE = /(\d+)\s*[-–—]\s*(\d+)/;

function lastInteger(label: string): number | null {
  const m = label.match(/\d+/g);
  return m === null ? null : Number(m[m.length - 1]);
}

/**
 * Does a block's group list include the chosen group? True for "all", an exact label
 * (ignoring case, accents and spacing) or a numeric range ("1-4", "Grupa 1–4") that contains
 * the number in the chosen group's label.
 */
export function matchesGroup(blockGroups: string[], group: string): boolean {
  const chosen = fold(group);
  const n = lastInteger(group);
  for (const entry of blockGroups) {
    const e = fold(entry);
    if (e === 'all' || e === chosen) return true;
    const r = e.match(RANGE);
    if (r !== null && n !== null) {
      const a = Number(r[1]);
      const b = Number(r[2]);
      if (Math.min(a, b) <= n && n <= Math.max(a, b)) return true;
    }
  }
  return false;
}

function uniqueByFold(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const k = fold(l);
    if (k === '' || seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

/** Group and semigroup labels to offer: the file's lists, else those seen in the blocks. */
export function groupOptions(file: TimetableImport): { groups: string[]; semigroups: string[] } {
  const groups =
    file.groups.length > 0
      ? uniqueByFold(file.groups)
      : uniqueByFold(
          file.blocks.flatMap((b) => b.groups).filter((g) => fold(g) !== 'all' && !RANGE.test(g)),
        );
  const semigroups =
    file.semigroups.length > 0
      ? uniqueByFold(file.semigroups)
      : uniqueByFold(file.blocks.flatMap((b) => (b.semigroup === null ? [] : [b.semigroup])));
  return { groups, semigroups };
}

/** The blocks that apply to the chosen group and semigroup, in file order. */
export function blocksFor(
  file: TimetableImport,
  group: string,
  semigroup: string | null,
): ImportBlock[] {
  return file.blocks
    .filter((b) => {
      if (!matchesGroup(b.groups, group)) return false;
      if (b.semigroup === null) return true;
      return semigroup !== null && fold(b.semigroup) === fold(semigroup);
    })
    .map((b) => ({ ...b, groups: [...b.groups], unsure: [...b.unsure] }));
}

export type ImportQuestion =
  | { kind: 'choose-one'; id: string; options: number[] }
  | { kind: 'type'; block: number }
  | { kind: 'unsure'; block: number; fields: string[] };

export interface PlanSubject {
  abbreviation: string;
  name: string;
  existingId: string | null;
}

export interface ImportPlan {
  blocks: ImportBlock[];
  questions: ImportQuestion[];
  subjects: PlanSubject[];
}

export interface ImportAnswers {
  /** choose-one id -> chosen block index */
  chosen: Record<string, number>;
  types: Record<number, ClassType>;
  /** by abbreviation as listed in plan.subjects */
  attending: Record<string, boolean>;
  edits: Record<number, Partial<ImportBlock>>;
}

function findExisting(data: PlannerData, abbreviation: string, name: string): Subject | null {
  const live = data.subjects.filter((s) => !s.deleted);
  const ak = subjectKey(abbreviation);
  const nk = subjectKey(name);
  return (
    live.find((s) => subjectKey(s.abbreviation) === ak) ??
    live.find((s) => subjectKey(s.name) === nk) ??
    null
  );
}

export function planTimetableImport(
  file: TimetableImport,
  data: PlannerData,
  group: string,
  semigroup: string | null,
): ImportPlan {
  const blocks = blocksFor(file, group, semigroup);

  const byGroup = new Map<string, number[]>();
  blocks.forEach((b, i) => {
    if (b.choiceGroup === null) return;
    const list = byGroup.get(b.choiceGroup) ?? [];
    list.push(i);
    byGroup.set(b.choiceGroup, list);
  });
  const questions: ImportQuestion[] = [];
  for (const [id, options] of byGroup) {
    if (options.length >= 2) questions.push({ kind: 'choose-one', id, options });
  }
  blocks.forEach((b, i) => {
    if (b.type === null) questions.push({ kind: 'type', block: i });
    if (b.unsure.length > 0) questions.push({ kind: 'unsure', block: i, fields: [...b.unsure] });
  });

  const subjects: PlanSubject[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    const key = subjectKey(b.subject);
    if (seen.has(key)) continue;
    seen.add(key);
    const entries = file.subjects.filter((s) => subjectKey(s.abbreviation) === key);
    const entry = entries.find((s) => s.abbreviation === b.subject) ?? entries[0];
    const abbreviation = entry?.abbreviation ?? b.subject;
    const name = entry?.name ?? b.subject;
    subjects.push({
      abbreviation,
      name,
      existingId: findExisting(data, abbreviation, name)?.id ?? null,
    });
  }
  return { blocks, questions, subjects };
}

function droppedBlocks(plan: ImportPlan, answers: ImportAnswers): Set<number> {
  const dropped = new Set<number>();
  for (const q of plan.questions) {
    if (q.kind !== 'choose-one') continue;
    const pick = answers.chosen[q.id];
    for (const i of q.options) if (i !== pick) dropped.add(i);
  }
  return dropped;
}

/** True once every choice is made and every kept block has a type. Notes about unsure fields don't count. */
export function isComplete(plan: ImportPlan, answers: ImportAnswers): boolean {
  for (const q of plan.questions) {
    if (q.kind === 'choose-one' && !q.options.includes(answers.chosen[q.id])) return false;
  }
  const dropped = droppedBlocks(plan, answers);
  for (const q of plan.questions) {
    if (q.kind !== 'type' || dropped.has(q.block)) continue;
    const t = answers.types[q.block] ?? answers.edits[q.block]?.type ?? null;
    if (t === null) return false;
  }
  return true;
}

export function applyAnswers(
  plan: ImportPlan,
  answers: ImportAnswers,
  data: PlannerData,
  now: number,
  newId: () => string,
): { subjects: Subject[]; patterns: ClassPattern[] } {
  const dropped = droppedBlocks(plan, answers);
  const planByKey = new Map(plan.subjects.map((s) => [subjectKey(s.abbreviation), s]));

  const subjects: Subject[] = [];
  const idByKey = new Map<string, string>();
  const resolve = (abbreviation: string): string => {
    const key = subjectKey(abbreviation);
    const known = idByKey.get(key);
    if (known !== undefined) return known;
    const entry: PlanSubject = planByKey.get(key) ?? {
      abbreviation,
      name: abbreviation,
      existingId: findExisting(data, abbreviation, abbreviation)?.id ?? null,
    };
    const existing =
      entry.existingId === null
        ? null
        : (data.subjects.find((s) => s.id === entry.existingId && !s.deleted) ?? null);
    const wanted = answers.attending[entry.abbreviation];
    let id: string;
    if (existing !== null) {
      id = existing.id;
      if (wanted !== undefined && wanted !== existing.attending) {
        subjects.push({ ...existing, attending: wanted, updatedAt: stamp(existing) });
      }
    } else {
      id = newId();
      subjects.push({
        id,
        name: entry.name,
        abbreviation: entry.abbreviation,
        attending: wanted ?? true,
        updatedAt: now,
      });
    }
    idByKey.set(key, id);
    return id;
  };

  const known = data.patterns.filter((p) => !p.deleted);
  const sig = (p: ClassPattern) =>
    [p.subjectId, p.type, p.weekday, p.start, p.end, p.room, p.repeat].join('|');
  const seen = new Set(known.map(sig));

  const patterns: ClassPattern[] = [];
  plan.blocks.forEach((original, i) => {
    if (dropped.has(i)) return;
    const b: ImportBlock = { ...original, ...answers.edits[i] };
    const type = answers.types[i] ?? b.type;
    if (type === null) return;
    const pattern: ClassPattern = {
      id: '',
      updatedAt: now,
      subjectId: resolve(b.subject),
      type,
      weekday: b.day,
      start: b.start,
      end: b.end,
      room: b.room ?? '',
      teacher: b.teacher ?? '',
      repeat: b.weeks,
      validFrom: OPEN_START,
      validTo: null,
      online: b.online,
      source: 'import',
    };
    const s = sig(pattern);
    if (seen.has(s)) return;
    seen.add(s);
    pattern.id = newId();
    patterns.push(pattern);
  });
  return { subjects, patterns };
}
