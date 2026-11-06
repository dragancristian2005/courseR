import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { clearPending, getPending } from '../../src/data/importSession';
import { newId } from '../../src/data/ids';
import { useStore } from '../../src/data/useStore';
import { compareDates, todayISO } from '../../src/domain/dates';
import { droppedByChange } from '../../src/domain/edits';
import type { ImportBlock, TimetableImport } from '../../src/domain/importFormat';
import { applyDiff, diffImport } from '../../src/domain/importDiff';
import {
  applyAnswers,
  groupOptions,
  isComplete,
  planTimetableImport,
  subjectKey,
  type ImportAnswers,
  type ImportQuestion,
  type ImportPlan,
  type PlanSubject,
} from '../../src/domain/importPlan';
import type { ClassPattern, ClassType, PlannerData } from '../../src/domain/types';
import { Button } from '../../src/ui/Button';
import { droppedWarning } from '../../src/ui/ChangeForm';
import { Chips, Field, isDate, MSG_DATE } from '../../src/ui/FormBits';
import { TYPE_LABEL, WEEKDAYS_LONG } from '../../src/ui/format';
import { FormScreen } from '../../src/ui/FormScreen';
import { ImportBlockRow, whenWords } from '../../src/ui/ImportBlockRow';
import { ChooseOneQuestion, TypeQuestion, UnsureQuestion } from '../../src/ui/ImportQuestionBox';
import { ImportSubjectRow } from '../../src/ui/ImportSubjectRow';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const EMPTY: ImportAnswers = { chosen: {}, types: {}, attending: {}, edits: {} };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function ImportReview() {
  const [file] = useState<TimetableImport | null>(() => {
    const p = getPending();
    return p !== null && p.kind === 'timetable' ? p : null;
  });
  if (file === null) {
    return (
      <FormScreen title="Check your timetable">
        <Rule weight="heavy" />
        <Text>Nothing to review. Start an import from Settings.</Text>
        <Button label="Go to import" onPress={() => router.push('/import')} />
      </FormScreen>
    );
  }
  return <Review file={file} />;
}

/** Block indexes dropped because another option of their choose-one was picked. */
function droppedSet(plan: ImportPlan, answers: ImportAnswers): Set<number> {
  const dropped = new Set<number>();
  for (const q of plan.questions) {
    if (q.kind !== 'choose-one') continue;
    const pick = answers.chosen[q.id];
    if (pick === undefined) continue;
    for (const i of q.options) if (i !== pick) dropped.add(i);
  }
  return dropped;
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
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [failed, setFailed] = useState(false);
  const previewId = useRef(0);

  const needsSemigroup = opts.semigroups.length > 0;
  const effGroup = opts.groups.length === 0 ? 'all' : group;
  const chosen = effGroup !== null && (!needsSemigroup || semigroup !== null);
  const plan = useMemo(
    () =>
      chosen ? planTimetableImport(file, data, effGroup, needsSemigroup ? semigroup : null) : null,
    [chosen, file, data, effGroup, needsSemigroup, semigroup],
  );

  const reimport = data.patterns.some(
    (p) => !p.deleted && p.source === 'import' && p.validTo === null,
  );
  // Earlier imports, ended or not, must not hide classes from applyAnswers' duplicate check:
  // a class dropped by one re-import can come back on a later sheet. Manual classes still count.
  const baseData = useMemo<PlannerData>(
    () => ({
      ...data,
      patterns: data.patterns.filter((p) => p.deleted || p.source !== 'import'),
    }),
    [data],
  );
  const complete = plan !== null && isComplete(plan, answers);
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

  const reset = () => setAnswers(EMPTY);
  const patch = (fn: (a: ImportAnswers) => ImportAnswers) => setAnswers((a) => fn(a));

  const header = (
    <>
      <Rule weight="heavy" />
      {file.title ? <Text variant="meta">{file.title}</Text> : null}
      <Chips
        label="Which group are you in?"
        options={opts.groups.map((g) => ({ value: g, label: g }))}
        value={group}
        onChange={(g) => {
          setGroup(g);
          reset();
        }}
      />
    </>
  );
  const semigroupChips =
    needsSemigroup && effGroup !== null ? (
      <Chips
        label="Which semigroup?"
        options={opts.semigroups.map((g) => ({ value: g, label: g }))}
        value={semigroup}
        onChange={(g) => {
          setSemigroup(g);
          reset();
        }}
      />
    ) : null;
  const pickers = (
    <>
      {opts.groups.length > 0 ? (
        header
      ) : (
        <>
          <Rule weight="heavy" />
          {file.title ? <Text variant="meta">{file.title}</Text> : null}
        </>
      )}
      {semigroupChips}
    </>
  );
  if (plan === null) return <FormScreen title="Check your timetable">{pickers}</FormScreen>;

  const dropped = droppedSet(plan, answers);
  const effective = (i: number): ImportBlock => {
    const b = { ...plan.blocks[i], ...answers.edits[i] };
    return { ...b, type: answers.types[i] ?? b.type };
  };
  const nameOf = (abbreviation: string) =>
    plan.subjects.find((s) => subjectKey(s.abbreviation) === subjectKey(abbreviation))?.name ??
    abbreviation;

  const missing =
    plan.questions.filter((q) => q.kind === 'choose-one' && answers.chosen[q.id] === undefined)
      .length +
    plan.questions.filter(
      (q) => q.kind === 'type' && !dropped.has(q.block) && effective(q.block).type === null,
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
            nameOf(plan.blocks[a].subject).localeCompare(nameOf(plan.blocks[b].subject)),
        ),
    }))
    .filter((d) => d.items.length > 0);

  const renderBlock = (i: number) => {
    const block = effective(i);
    const isDropped = dropped.has(i);
    const choice = plan.questions.find(
      (q): q is Extract<ImportQuestion, { kind: 'choose-one' }> =>
        q.kind === 'choose-one' && q.options.includes(i),
    );
    const choiceOpen = choice !== undefined && answers.chosen[choice.id] === undefined;
    const typeQ = !isDropped && plan.questions.some((q) => q.kind === 'type' && q.block === i);
    const unsureQ = plan.questions.find((q) => q.kind === 'unsure' && q.block === i);
    const open =
      choiceOpen ||
      (!isDropped && block.type === null) ||
      (!isDropped && unsureQ !== undefined && answers.edits[i] === undefined);
    return (
      <ImportBlockRow
        key={i}
        testID={`import-block-${i}`}
        block={block}
        title={nameOf(block.subject)}
        open={open}
        dimmed={isDropped}
      >
        {choice !== undefined && choice.options[0] === i ? (
          <ChooseOneQuestion
            options={choice.options.map((index) => ({
              index,
              block: effective(index),
              title: nameOf(effective(index).subject),
            }))}
            chosen={answers.chosen[choice.id]}
            onChoose={(index) =>
              patch((a) => ({ ...a, chosen: { ...a.chosen, [choice.id]: index } }))
            }
          />
        ) : null}
        {typeQ ? (
          <TypeQuestion
            value={block.type}
            onChange={(t: ClassType) => patch((a) => ({ ...a, types: { ...a.types, [i]: t } }))}
          />
        ) : null}
        {!isDropped && unsureQ !== undefined && unsureQ.kind === 'unsure' ? (
          <UnsureQuestion
            fields={unsureQ.fields}
            block={block}
            showType={!typeQ}
            type={block.type}
            onType={(t) => patch((a) => ({ ...a, types: { ...a.types, [i]: t } }))}
            onEdit={(p) =>
              patch((a) => ({ ...a, edits: { ...a.edits, [i]: { ...a.edits[i], ...p } } }))
            }
          />
        ) : null}
      </ImportBlockRow>
    );
  };

  // Subjects of the classes that stay, in sheet order.
  const kept: PlanSubject[] = [];
  plan.blocks.forEach((_, i) => {
    if (dropped.has(i)) return;
    const key = subjectKey(effective(i).subject);
    if (kept.some((s) => subjectKey(s.abbreviation) === key)) return;
    kept.push(
      plan.subjects.find((s) => subjectKey(s.abbreviation) === key) ?? {
        abbreviation: effective(i).subject,
        name: effective(i).subject,
        existingId: null,
      },
    );
  });
  const existingOf = (s: PlanSubject) =>
    s.existingId === null
      ? undefined
      : data.subjects.find((x) => x.id === s.existingId && !x.deleted);
  const attendingOf = (s: PlanSubject) =>
    answers.attending[s.abbreviation] ?? existingOf(s)?.attending ?? true;

  const fromOk = !reimport || isDate(from);
  const nothing =
    complete &&
    applied !== null &&
    applied.subjects.length === 0 &&
    (diff !== null ? diff.added.length + diff.removed.length === 0 : applied.patterns.length === 0);

  const nameForPattern = (p: ClassPattern) =>
    [...(applied?.subjects ?? []), ...data.subjects].find((s) => s.id === p.subjectId)?.name ?? '';
  const patternLine = (p: ClassPattern) =>
    [
      whenWords(p.weekday, p.start, p.end),
      nameForPattern(p),
      TYPE_LABEL[p.type].toLowerCase(),
      p.room,
    ]
      .filter(Boolean)
      .join(', ');

  const warning = (() => {
    if (diff === null || !isDate(from)) return null;
    const dropped = { overrides: [] as never[], notes: [] as never[] };
    for (const p of diff.removed) {
      const d = droppedByChange(data, p.id, from);
      dropped.overrides.push(...(d.overrides as never[]));
      dropped.notes.push(...(d.notes as never[]));
    }
    return dropped.overrides.length + dropped.notes.length > 0
      ? droppedWarning(dropped, from)
      : null;
  })();

  const save = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setFailed(false);
    try {
      const now = Date.now();
      const result = applyAnswers(plan, answers, baseData, now, newId);
      const patterns = reimport
        ? applyDiff(diffImport(result.patterns, data), from, now, newId)
        : result.patterns;
      for (const s of result.subjects) await repo.upsert('subjects', s);
      for (const p of patterns) await repo.upsert('patterns', p);
      clearPending();
      router.replace('/');
    } catch {
      setFailed(true);
      saveLock.current = false;
      setSaving(false);
    }
  };

  const total = plan.blocks.length;
  const q = plan.questions.length;
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
          {items.map(renderBlock)}
        </View>
      ))}
      <View>
        <Text variant="title">Subjects</Text>
        <Rule weight="heavy" />
        {kept.map((s) => (
          <ImportSubjectRow
            key={s.abbreviation}
            name={s.name}
            abbreviation={s.abbreviation}
            existing={existingOf(s) !== undefined}
            on={attendingOf(s)}
            onToggle={(v) =>
              patch((a) => ({ ...a, attending: { ...a.attending, [s.abbreviation]: v } }))
            }
          />
        ))}
      </View>
      {reimport ? (
        <View style={styles.block}>
          <Field
            label="Apply changes from"
            value={from}
            onChangeText={setFrom}
            error={isDate(from) ? undefined : MSG_DATE}
          />
          {diff !== null ? (
            <>
              <Text style={styles.bold}>
                {`${diff.added.length} new, ${diff.removed.length} removed, ${diff.unchanged.length} unchanged`}
              </Text>
              {diff.added.length > 0 ? (
                <View>
                  <Text variant="meta">New classes</Text>
                  {diff.added.map((p, k) => (
                    <Text key={`a${k}`}>{patternLine(p)}</Text>
                  ))}
                </View>
              ) : null}
              {diff.removed.length > 0 ? (
                <View>
                  <Text variant="meta">Removed classes</Text>
                  {diff.removed.map((p) => (
                    <Text key={p.id}>{patternLine(p)}</Text>
                  ))}
                </View>
              ) : null}
              {warning ? <Text style={styles.warning}>{warning}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}
      <View style={styles.block}>
        <Rule weight="heavy" />
        <Button
          label={nothing ? 'Nothing to change' : 'Save timetable'}
          disabled={!complete || nothing || !fromOk || saving}
          onPress={() => void save()}
        />
        {nothing ? (
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
  bold: { fontFamily: theme.font.appBold },
  block: { gap: theme.space(3) },
  warning: { color: theme.color.now, fontFamily: theme.font.appBold },
});
