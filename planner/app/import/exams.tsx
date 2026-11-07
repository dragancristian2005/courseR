import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { clearPending, getPending } from '../../src/data/importSession';
import { newId } from '../../src/data/ids';
import { useStore } from '../../src/data/useStore';
import { examGroupOptions, planExamImport, type ExamPlan } from '../../src/domain/examImport';
import type { ExamImport } from '../../src/domain/importFormat';
import type { Exam } from '../../src/domain/types';
import { Button } from '../../src/ui/Button';
import { Chips, Field, isDate, isTime, MSG_TIME } from '../../src/ui/FormBits';
import { shortDate } from '../../src/ui/format';
import { FormScreen } from '../../src/ui/FormScreen';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { TextButton } from '../../src/ui/TextButton';
import { theme } from '../../src/ui/theme';

const MSG_EXAM_DATE = 'Enter a date like 2027-01-20.';
const TITLE = 'Check your exams';

interface Edit {
  date: string;
  start: string;
  room: string;
}

const FIELD_WORDS: Record<string, string> = {
  subject: 'subject',
  date: 'date',
  start: 'start time',
  room: 'room',
};

function inWords(fields: string[]): string {
  const words = fields.map((f) => FIELD_WORDS[f] ?? f);
  return words.length <= 1
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

const editInvalid = (e: Edit | undefined) =>
  e !== undefined && (!isDate(e.date) || (e.start !== '' && !isTime(e.start)));

export default function ImportExams() {
  const [file] = useState<ExamImport | null>(() => {
    const p = getPending();
    return p !== null && p.kind === 'exams' ? p : null;
  });
  if (file === null) {
    return (
      <FormScreen title={TITLE}>
        <Rule weight="heavy" />
        <Text>Nothing to review. Start an import from Settings.</Text>
        <Button label="Go to import" onPress={() => router.push('/import')} />
      </FormScreen>
    );
  }
  return <Review file={file} />;
}

function Review({ file }: { file: ExamImport }) {
  const { data, repo, ready } = useStore();
  const groups = useMemo(() => examGroupOptions(file), [file]);
  const [group, setGroup] = useState<string | null>(groups.length === 1 ? groups[0] : null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  // Real ids given at save time, kept so a retry after a failure writes the same records.
  const realIds = useRef<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  const effGroup = groups.length === 0 ? 'all' : group;
  // The list is planned once, when the group is chosen: later store snapshots must not reshuffle
  // it or drop edits. Duplicates are checked again against the current data on save.
  const planned = useRef<{ group: string; plan: ExamPlan } | null>(null);
  if (ready && effGroup !== null && planned.current?.group !== effGroup) {
    let n = 0;
    planned.current = {
      group: effGroup,
      plan: planExamImport(file, data, effGroup, Date.now(), () => `imp-${n++}`),
    };
  }
  const plan =
    effGroup !== null && planned.current?.group === effGroup ? planned.current.plan : null;

  const picker =
    groups.length > 0 ? (
      <Chips
        label="Which group are you in?"
        options={groups.map((g) => ({ value: g, label: g }))}
        value={group}
        onChange={(g) => {
          setGroup(g);
          setEdits({});
          setOpen({});
        }}
      />
    ) : null;
  if (plan === null) {
    return (
      <FormScreen title={TITLE}>
        <Rule weight="heavy" />
        {picker}
      </FormScreen>
    );
  }

  const apply = (e: Exam): Exam => {
    const ed = edits[e.id];
    if (ed === undefined || editInvalid(ed)) return e;
    return { ...e, date: ed.date, start: ed.start === '' ? null : ed.start, room: ed.room.trim() };
  };
  const rows = plan.exams
    .map(apply)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
  const anyInvalid = Object.values(edits).some((e) => editInvalid(e));
  const nameOf = (e: Exam) =>
    (e.subjectId === null ? undefined : data.subjects.find((s) => s.id === e.subjectId)?.name) ??
    e.title;

  const patch = (e: Exam, p: Partial<Edit>) =>
    setEdits((all) => ({
      ...all,
      [e.id]: {
        ...(all[e.id] ?? { date: e.date, start: e.start ?? '', room: e.room }),
        ...p,
      },
    }));

  const save = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setFailed(false);
    try {
      const now = Date.now();
      const fresh = planExamImport(file, data, effGroup ?? 'all', now, newId);
      const stillNew = new Set(Object.values(fresh.sources));
      for (const e of rows) {
        if (!stillNew.has(plan.sources[e.id])) continue;
        realIds.current[e.id] ??= newId();
        await repo.upsert('exams', { ...e, id: realIds.current[e.id], updatedAt: now });
      }
      clearPending();
      router.replace('/exams');
    } catch {
      setFailed(true);
      saveLock.current = false;
      setSaving(false);
    }
  };

  const nothing = rows.length === 0;
  if (plan.exams.length + plan.skipped === 0) {
    return (
      <FormScreen title={TITLE}>
        <Rule weight="heavy" />
        {picker}
        <Text>{`No exams for ${effGroup} on this sheet. Pick another group, or ask Claude to copy the group headers exactly.`}</Text>
        <View style={styles.footer}>
          <Rule weight="heavy" />
          <Button label="Save exams" disabled onPress={() => undefined} />
        </View>
      </FormScreen>
    );
  }
  return (
    <FormScreen title={TITLE}>
      <Rule weight="heavy" />
      {picker}
      <Text variant="meta">Nothing is saved until you tap Save.</Text>
      {plan.skipped > 0 ? (
        <Text variant="meta">{`${plan.skipped} already in your planner`}</Text>
      ) : null}
      <View>
        {rows.map((e) => {
          const unsure = plan.unsure[e.id];
          const ed = edits[e.id];
          const flagged = unsure !== undefined;
          const meta = [shortDate(e.date), e.start, e.room ? `room ${e.room}` : null]
            .filter(Boolean)
            .join(', ');
          return (
            <View key={e.id} testID={`exam-${e.id}`} style={[styles.box, flagged && styles.open]}>
              <View style={styles.cell}>
                <Text style={styles.title} testID={`exam-title-${e.id}`}>
                  {nameOf(e)}
                </Text>
                <Text variant="meta">{meta}</Text>
              </View>
              {flagged ? (
                <View style={styles.question}>
                  <Text
                    style={styles.title}
                  >{`Check this: ${inWords(unsure)} may be misread.`}</Text>
                  {open[e.id] ? (
                    <View style={styles.question}>
                      <Field
                        label="Date"
                        value={ed?.date ?? e.date}
                        onChangeText={(v) => patch(e, { date: v })}
                        error={isDate(ed?.date ?? e.date) ? undefined : MSG_EXAM_DATE}
                      />
                      <Field
                        label="Start"
                        value={ed?.start ?? e.start ?? ''}
                        onChangeText={(v) => patch(e, { start: v })}
                        error={
                          (ed?.start ?? e.start ?? '') === '' || isTime(ed?.start ?? e.start ?? '')
                            ? undefined
                            : MSG_TIME
                        }
                      />
                      <Field
                        label="Room"
                        value={ed?.room ?? e.room}
                        onChangeText={(v) => patch(e, { room: v })}
                      />
                      <TextButton
                        label="Done"
                        onPress={() => setOpen((o) => ({ ...o, [e.id]: false }))}
                      />
                    </View>
                  ) : (
                    <TextButton
                      label="Edit"
                      onPress={() => setOpen((o) => ({ ...o, [e.id]: true }))}
                    />
                  )}
                </View>
              ) : null}
              {flagged ? null : <Rule weight="hair" />}
            </View>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Rule weight="heavy" />
        <Button
          label={nothing ? 'Nothing to add' : 'Save exams'}
          disabled={nothing || anyInvalid || saving}
          onPress={() => void save()}
        />
        {nothing ? <Text variant="meta">These exams are already in your planner.</Text> : null}
        {failed ? <Text style={styles.warning}>Couldn’t save. Try again.</Text> : null}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderColor: 'transparent' },
  open: { borderColor: theme.color.now, marginVertical: theme.space(1) },
  cell: { padding: theme.space(3), gap: 2 },
  title: { fontFamily: theme.font.appBold },
  question: { padding: theme.space(3), gap: theme.space(3) },
  footer: { gap: theme.space(3) },
  warning: { color: theme.color.now, fontFamily: theme.font.appBold },
});
