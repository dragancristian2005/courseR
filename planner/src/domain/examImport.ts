import type { ExamImport } from './importFormat';
import { findSubject, fold, matchesGroup, RANGE, uniqueByFold } from './importPlan';
import type { Exam, PlannerData } from './types';

export interface ExamPlan {
  exams: Exam[];
  skipped: number;
  unsure: Record<string, string[]>;
  /** New exam id -> index of the exam in the file it came from. */
  sources: Record<string, number>;
}

/**
 * Exams from the file that apply to the chosen group, ready to save. Exams already in the
 * planner (same subject, date and start) are skipped and counted. `unsure` maps a new exam's id
 * to the fields Claude flagged, for the review screen.
 */
export function planExamImport(
  file: ExamImport,
  data: PlannerData,
  group: string,
  now: number,
  newId: () => string,
  /** The user's edited date and start per source row, used for the duplicate check. */
  edited: Record<number, { date: string; start: string | null }> = {},
): ExamPlan {
  const live = data.exams.filter((e) => !e.deleted);
  const exams: Exam[] = [];
  const unsure: Record<string, string[]> = {};
  const sources: Record<string, number> = {};
  let skipped = 0;

  for (const [index, e] of file.exams.entries()) {
    if (!matchesGroup(e.groups, group)) continue;
    const date = edited[index]?.date ?? e.date;
    const start = edited[index] === undefined ? e.start : edited[index].start;
    const subject = findSubject(data, e.subject, e.subjectName ?? e.subject);
    const base = e.title ?? 'Exam';
    const title = subject === null ? `${e.subjectName ?? e.subject}: ${base}` : base;
    const subjectId = subject?.id ?? null;
    // An exam saved while its subject was unknown carries the subject in its title.
    const unlinked = `${e.subjectName ?? e.subject}: ${base}`;
    const taken = (x: Exam) =>
      x.date === date &&
      x.start === start &&
      (subjectId === null
        ? x.subjectId === null && x.title === title
        : x.subjectId === subjectId || (x.subjectId === null && x.title === unlinked));
    if (live.some(taken) || exams.some(taken)) {
      skipped++;
      continue;
    }
    const exam: Exam = {
      id: newId(),
      updatedAt: now,
      subjectId,
      title,
      date,
      start,
      room: e.room ?? '',
    };
    exams.push(exam);
    sources[exam.id] = index;
    if (e.unsure.length > 0) unsure[exam.id] = [...e.unsure];
  }
  return { exams, skipped, unsure, sources };
}

/** Group labels to offer for an exams file: its list, else those seen in the exams. */
export function examGroupOptions(file: ExamImport): string[] {
  return file.groups.length > 0
    ? uniqueByFold(file.groups)
    : uniqueByFold(
        file.exams.flatMap((e) => e.groups).filter((g) => fold(g) !== 'all' && !RANGE.test(g)),
      );
}
