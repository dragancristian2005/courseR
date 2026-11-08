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

export const RANGE = /(\d+)\s*[-–—]\s*(\d+)/;

function lastInteger(label: string): number | null {
  const m = label.match(/\d+/g);
  return m === null ? null : Number(m[m.length - 1]);
}

/** "semigrupa 1" and "1" are the same semigroup: equal labels, or the same last number. */
function sameSemigroup(a: string, b: string): boolean {
  if (fold(a) === fold(b)) return true;
  const na = lastInteger(a);
  return na !== null && na === lastInteger(b);
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

export function uniqueByFold(labels: string[]): string[] {
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
      return semigroup !== null && sameSemigroup(b.semigroup, semigroup);
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
  /** Blocks whose "Check this" note the student has looked at (Done), by block index. */
  checked?: Record<number, boolean>;
}

/** The live subject whose abbreviation, else whose name, matches. Empty keys never match. */
export function findSubject(data: PlannerData, abbreviation: string, name: string): Subject | null {
  const live = data.subjects.filter((s) => !s.deleted);
  const ak = subjectKey(abbreviation);
  const nk = subjectKey(name);
  return (
    (ak === '' ? undefined : live.find((s) => subjectKey(s.abbreviation) === ak)) ??
    (nk === '' ? undefined : live.find((s) => subjectKey(s.name) === nk)) ??
    null
  );
}

/** What makes two classes the same class when importing and when diffing a re-import. */
export function patternSignature(p: ClassPattern): string {
  return JSON.stringify([
    p.subjectId,
    p.type,
    p.weekday,
    p.start,
    p.end,
    p.room,
    p.repeat,
    p.online,
  ]);
}

/**
 * The sheet's subject entry for a block's subject text: by abbreviation first, else by full
 * name ("Testarea sistemelor software" written out in a block).
 */
function entryFor(file: TimetableImport, subject: string) {
  const key = subjectKey(subject);
  const byAbbreviation = file.subjects.filter((s) => subjectKey(s.abbreviation) === key);
  if (byAbbreviation.length > 0) {
    return byAbbreviation.find((s) => s.abbreviation === subject) ?? byAbbreviation[0];
  }
  return file.subjects.find((s) => subjectKey(s.name) === key);
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
    if (subjectKey(b.subject) === '') continue;
    const entry = entryFor(file, b.subject);
    const abbreviation = entry?.abbreviation ?? b.subject;
    const name = entry?.name ?? b.subject;
    const key = subjectKey(abbreviation);
    if (seen.has(key)) continue;
    seen.add(key);
    subjects.push({
      abbreviation,
      name,
      existingId: findSubject(data, abbreviation, name)?.id ?? null,
    });
  }
  return { blocks, questions, subjects };
}

/** Block indexes dropped because another option of their choose-one was picked. */
export function droppedBlocks(plan: ImportPlan, answers: ImportAnswers): Set<number> {
  const dropped = new Set<number>();
  for (const q of plan.questions) {
    if (q.kind !== 'choose-one') continue;
    const pick = answers.chosen[q.id];
    if (pick === undefined) continue;
    for (const i of q.options) if (i !== pick) dropped.add(i);
  }
  return dropped;
}

/** A plan block with the answers' edits and chosen type applied. */
export function effectiveBlock(plan: ImportPlan, answers: ImportAnswers, i: number): ImportBlock {
  const b = { ...plan.blocks[i], ...answers.edits[i] };
  return { ...b, type: answers.types[i] ?? b.type };
}

/** The plan's subject for a block's subject text: by abbreviation, else by full name. */
export function planSubjectFor(plan: ImportPlan, text: string): PlanSubject | undefined {
  const key = subjectKey(text);
  if (key === '') return undefined;
  return (
    plan.subjects.find((s) => subjectKey(s.abbreviation) === key) ??
    plan.subjects.find((s) => subjectKey(s.name) === key)
  );
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
  const subjects: Subject[] = [];
  const created: Subject[] = [];
  const idByKey = new Map<string, string>();
  const idByEntry = new Map<string, string>();
  // Sheet spellings of the kept classes, by the existing subject they land on.
  const spellingsOf = new Map<string, Set<string>>();
  plan.blocks.forEach((_, i) => {
    if (dropped.has(i)) return;
    const text = effectiveBlock(plan, answers, i).subject;
    if (subjectKey(text) === '') return;
    const entry = planSubjectFor(plan, text);
    if (entry === undefined || entry.existingId === null) return;
    const set = spellingsOf.get(entry.existingId) ?? new Set<string>();
    set.add(entry.abbreviation);
    spellingsOf.set(entry.existingId, set);
  });
  /** Two entries on one subject: it is on if any entry is on (an unanswered one keeps its state). */
  const wantedFor = (entry: PlanSubject, existing: Subject): boolean | undefined => {
    const spellings = spellingsOf.get(existing.id) ?? new Set([entry.abbreviation]);
    spellings.add(entry.abbreviation);
    const answered = [...spellings].filter((a) => answers.attending[a] !== undefined);
    if (answered.length === 0) return undefined;
    return [...spellings].some((a) => answers.attending[a] ?? existing.attending);
  };
  const resolve = (text: string): string => {
    const key = subjectKey(text);
    const known = idByKey.get(key);
    if (known !== undefined) return known;
    const entry: PlanSubject = planSubjectFor(plan, text) ?? {
      abbreviation: text,
      name: text,
      existingId: findSubject(data, text, text)?.id ?? null,
    };
    const entryKey = subjectKey(entry.abbreviation);
    let id = idByEntry.get(entryKey);
    if (id === undefined) {
      const existing =
        entry.existingId === null
          ? null
          : (data.subjects.find((s) => s.id === entry.existingId && !s.deleted) ?? null);
      const wanted =
        existing === null ? answers.attending[entry.abbreviation] : wantedFor(entry, existing);
      const sameImport =
        existing === null
          ? created.find((s) => subjectKey(s.name) === subjectKey(entry.name))
          : undefined;
      if (existing !== null) {
        id = existing.id;
        // Two sheet spellings can land on one subject: update it once.
        if (
          wanted !== undefined &&
          wanted !== existing.attending &&
          !subjects.some((s) => s.id === existing.id)
        ) {
          subjects.push({ ...existing, attending: wanted, updatedAt: stamp(existing) });
        }
      } else if (sameImport !== undefined) {
        id = sameImport.id;
      } else {
        id = newId();
        const fresh: Subject = {
          id,
          name: entry.name,
          abbreviation: entry.abbreviation,
          attending: wanted ?? true,
          updatedAt: now,
        };
        subjects.push(fresh);
        created.push(fresh);
      }
      idByEntry.set(entryKey, id);
    }
    idByKey.set(key, id);
    return id;
  };

  const known = data.patterns.filter((p) => !p.deleted);
  const seen = new Set(known.map(patternSignature));

  const patterns: ClassPattern[] = [];
  plan.blocks.forEach((_, i) => {
    if (dropped.has(i)) return;
    const b = effectiveBlock(plan, answers, i);
    if (subjectKey(b.subject) === '') return;
    const type = b.type;
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
    const s = patternSignature(pattern);
    if (seen.has(s)) return;
    seen.add(s);
    pattern.id = newId();
    patterns.push(pattern);
  });
  return { subjects, patterns };
}
