import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { clearPending, getPending } from '../../src/data/importSession';
import { newId } from '../../src/data/ids';
import { useStore } from '../../src/data/useStore';
import { compareDates, todayISO } from '../../src/domain/dates';
import type { TimetableImport } from '../../src/domain/importFormat';
import { applyDiff, diffImport } from '../../src/domain/importDiff';
import {
  applyAnswers,
  droppedBlocks,
  offBlocks,
  effectiveBlock,
  groupOptions,
  isComplete,
  planSubjectFor,
  planTimetableImport,
  subjectKey,
  type ImportAnswers,
  type PlanSubject,
} from '../../src/domain/importPlan';
import type { ImportQuestion } from '../../src/domain/importPlan';
import type { PlannerData } from '../../src/domain/types';
import { Button } from '../../src/ui/Button';
import { leaveImport } from '../../src/ui/leaveImport';
import { NothingToReview } from '../../src/ui/NothingToReview';
import { useSaveLock } from '../../src/ui/useSaveLock';
import { isDate } from '../../src/ui/FormBits';
import { WEEKDAYS_LONG } from '../../src/ui/format';
import { FormScreen } from '../../src/ui/FormScreen';
import { ImportClassRow, subjectNameOf } from '../../src/ui/ImportClassRow';
import { ImportGroupPickers } from '../../src/ui/ImportGroupPickers';
import { ImportKeptSubjects } from '../../src/ui/ImportKeptSubjects';
import { ImportReimportPanel } from '../../src/ui/ImportReimportPanel';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const EMPTY: ImportAnswers = { chosen: {}, types: {}, attending: {}, edits: {}, checked: {} };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function ImportReview() {
  const [file] = useState<TimetableImport | null>(() => {
    const p = getPending();
    return p !== null && p.kind === 'timetable' ? p : null;
  });
  if (file === null) {
    return <NothingToReview title="Check your timetable" onGo={() => router.push('/import')} />;
  }
  return <Review file={file} />;
}

function Review({ file }: { file: TimetableImport }) {
  const { data, repo } = useStore();
  const opts = useMemo(() => groupOptions(file), [file]);
  const [group, setGroup] = useState<string | null>(
    opts.groups.length === 1 ? opts.groups[0] : null,
  );
  const [semigroup, setSemigroup] = useState<string | null>(
    opts.semigroups.length === 1 ? opts.semigroups[0] : null,
  );
  const [answers, setAnswers] = useState<ImportAnswers>(EMPTY);
  const today = todayISO();
  const [from, setFrom] = useState(
    file.validFrom !== null && compareDates(file.validFrom, today) > 0 ? file.validFrom : today,
  );
  const { saving, failed, run } = useSaveLock();
  const previewId = useRef(0);
  // Rows of the plan whose inline edit holds values that can't be saved.
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const setRowValid = (key: string, valid: boolean) =>
    setInvalid((all) => {
      if (valid === !all[key]) return all;
      const next = { ...all };
      if (valid) delete next[key];
      else next[key] = true;
      return next;
    });

  const needsSemigroup = opts.semigroups.length > 0;
  const effGroup = opts.groups.length === 0 ? 'all' : group;
  const chosen = effGroup !== null && (!needsSemigroup || semigroup !== null);
  const plan = useMemo(
    () =>
      chosen ? planTimetableImport(file, data, effGroup, needsSemigroup ? semigroup : null) : null,
    [chosen, file, data, effGroup, needsSemigroup, semigroup],
  );

  const reimport = data.patterns.some((p) => !p.deleted && p.source === 'import');
  // Earlier imports, ended or not, must not hide classes from applyAnswers' duplicate check:
  // a class dropped by one re-import can come back on a later sheet. Manual classes still count.
  const baseData = useMemo<PlannerData>(
    () => ({
      ...data,
      patterns: data.patterns.filter((p) => p.deleted || p.source !== 'import'),
    }),
    [data],
  );
  const complete = plan !== null && isComplete(plan, answers, data);
  const applied = useMemo(() => {
    if (plan === null || !complete) return null;
    return applyAnswers(
      plan,
      answers,
      baseData,
      Date.now(),
      () => `preview-${previewId.current++}`,
    );
  }, [plan, complete, answers, baseData]);
  const diff = useMemo(
    () => (reimport && applied !== null ? diffImport(applied.patterns, data) : null),
    [reimport, applied, data],
  );

  const reset = () => {
    setAnswers(EMPTY);
    setInvalid({});
  };
  const patch = (fn: (a: ImportAnswers) => ImportAnswers) => setAnswers((a) => fn(a));

  const pickers = (
    <ImportGroupPickers
      title={file.title}
      groups={opts.groups}
      semigroups={opts.semigroups}
      group={group}
      semigroup={semigroup}
      onGroup={(g) => {
        setGroup(g);
        reset();
      }}
      onSemigroup={(g) => {
        setSemigroup(g);
        reset();
      }}
    />
  );
  if (plan === null) return <FormScreen title="Check your timetable">{pickers}</FormScreen>;

  const dropped = droppedBlocks(plan, answers);
  // Classes of a subject switched off: dimmed, and nothing about them needs an answer.
  const off = offBlocks(plan, answers, data);
  const allOff = (q: ImportQuestion) =>
    q.kind === 'choose-one' && q.options.every((i) => off.has(i));
  const missing =
    plan.questions.filter(
      (q) => q.kind === 'choose-one' && !allOff(q) && answers.chosen[q.id] === undefined,
    ).length +
    plan.questions.filter(
      (q) =>
        q.kind === 'type' &&
        !dropped.has(q.block) &&
        !off.has(q.block) &&
        effectiveBlock(plan, answers, q.block).type === null,
    ).length;

  const days = [1, 2, 3, 4, 5, 6, 7]
    .map((day) => ({
      day,
      items: plan.blocks
        .map((_, i) => i)
        .filter((i) => plan.blocks[i].day === day)
        .sort(
          (a, b) =>
            plan.blocks[a].start.localeCompare(plan.blocks[b].start) ||
            subjectNameOf(plan, plan.blocks[a].subject).localeCompare(
              subjectNameOf(plan, plan.blocks[b].subject),
            ),
        ),
    }))
    .filter((d) => d.items.length > 0);

  // Subjects of the classes that stay, in sheet order.
  const kept: PlanSubject[] = [];
  plan.blocks.forEach((_, i) => {
    if (dropped.has(i)) return;
    const text = effectiveBlock(plan, answers, i).subject;
    const subject = planSubjectFor(plan, text) ?? {
      abbreviation: text,
      name: text,
      existingId: null,
    };
    if (subjectKey(subject.abbreviation) === '') return;
    if (kept.some((s) => subjectKey(s.abbreviation) === subjectKey(subject.abbreviation))) return;
    kept.push(subject);
  });

  const fromOk = !reimport || isDate(from);
  const anyInvalid = Object.keys(invalid).length > 0;
  const nothing =
    complete &&
    applied !== null &&
    applied.subjects.length === 0 &&
    (diff !== null
      ? diff.added.length + diff.removed.length + diff.reteached.length === 0
      : applied.patterns.length === 0);

  const save = () =>
    run(async () => {
      const now = Date.now();
      const result = applyAnswers(plan, answers, baseData, now, newId);
      const patterns = reimport
        ? applyDiff(diffImport(result.patterns, data), from, now, newId)
        : result.patterns;
      for (const s of result.subjects) await repo.upsert('subjects', s);
      for (const p of patterns) await repo.upsert('patterns', p);
      clearPending();
      leaveImport('/');
    });

  const total = plan.blocks.length;
  const q = plan.questions.length;
  if (total === 0) {
    const who =
      needsSemigroup && semigroup !== null ? `${effGroup}, semigroup ${semigroup}` : effGroup;
    return (
      <FormScreen title="Check your timetable">
        {pickers}
        <Text>{`No classes for ${who} on this sheet. Pick another group, or ask Claude to copy the group headers exactly.`}</Text>
        <View style={styles.block}>
          <Rule weight="heavy" />
          <Button label="Save timetable" disabled onPress={() => undefined} />
        </View>
      </FormScreen>
    );
  }
  return (
    <FormScreen title="Check your timetable">
      {pickers}
      <Text variant="meta">
        {`${plural(total, 'class', 'classes')} found, ${q} ${q === 1 ? 'needs' : 'need'} a look. Nothing is saved until you tap Save.`}
      </Text>
      {days.map(({ day, items }) => (
        <View key={day}>
          <Text variant="title">{WEEKDAYS_LONG[day - 1]}</Text>
          <Rule weight="heavy" />
          {items.map((i) => {
            const rowKey = `${group}|${semigroup}|${i}`;
            return (
              <ImportClassRow
                key={rowKey}
                index={i}
                plan={plan}
                answers={answers}
                dropped={dropped.has(i) || off.has(i)}
                choiceOff={plan.questions.some(
                  (q) => q.kind === 'choose-one' && q.options.includes(i) && allOff(q),
                )}
                rowKey={rowKey}
                invalid={invalid[rowKey] === true}
                onAnswers={patch}
                onValidChange={(valid) => setRowValid(rowKey, valid)}
              />
            );
          })}
        </View>
      ))}
      <ImportKeptSubjects
        subjects={kept}
        data={data}
        attending={answers.attending}
        onToggle={(abbreviation, v) =>
          patch((a) => ({ ...a, attending: { ...a.attending, [abbreviation]: v } }))
        }
      />
      {reimport ? (
        <ImportReimportPanel
          from={from}
          onFromChange={setFrom}
          diff={diff}
          data={data}
          newSubjects={applied?.subjects ?? []}
        />
      ) : null}
      <View style={styles.block}>
        <Rule weight="heavy" />
        <Button
          label={nothing ? 'Nothing to change' : 'Save timetable'}
          disabled={!complete || nothing || !fromOk || anyInvalid || saving}
          onPress={() => void save()}
        />
        {anyInvalid ? (
          <Text variant="meta">Fix the highlighted classes to save.</Text>
        ) : nothing ? (
          <Text variant="meta">Everything on this sheet is already in your planner.</Text>
        ) : !complete ? (
          <Text variant="meta">
            {missing === 1
              ? 'Answer the question above to save.'
              : `Answer the ${missing} questions above to save.`}
          </Text>
        ) : null}
        {failed ? <Text style={styles.warning}>Couldn’t save. Try again.</Text> : null}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  block: { gap: theme.space(3) },
  warning: { color: theme.color.now, fontFamily: theme.font.appBold },
});
