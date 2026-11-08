import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ClassroomError,
  fetchClassroom,
  getClassroomToken,
  takeClassroomToken,
  type ClassroomFetch,
} from '../../src/data/classroom';
import { newId } from '../../src/data/ids';
import { useStore } from '../../src/data/useStore';
import {
  applyClassroomImport,
  planClassroomImport,
  type ClassroomItem,
  type ClassroomPlan,
} from '../../src/domain/classroomImport';
import { todayISO } from '../../src/domain/dates';
import { stamp } from '../../src/domain/edits';
import { dueLabel } from '../../src/domain/selectors';
import type { ClassroomCourse, Homework, PlannerData } from '../../src/domain/types';
import { Button } from '../../src/ui/Button';
import { Chips } from '../../src/ui/FormBits';
import { FormScreen } from '../../src/ui/FormScreen';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const SKIP = 'skip';
const TITLE = 'Import from Classroom';

type Phase = 'start' | 'reading' | 'link' | 'review';

const messageOf = (e: unknown): string =>
  e instanceof ClassroomError ? e.message : 'Something went wrong reading Classroom. Try again.';

const dueText = (due: string | null, time: string | null, today: string): string => {
  if (due === null) return 'No due date';
  const label = dueLabel(due, today);
  return time === null ? label : `${label} ${time}`;
};

export default function ClassroomImport() {
  const { data, repo } = useStore();
  const [phase, setPhase] = useState<Phase>('start');
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<ClassroomFetch | null>(null);
  const [plan, setPlan] = useState<ClassroomPlan | null>(null);
  const [links, setLinks] = useState<ClassroomCourse[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Record<string, 'mine' | 'classroom'>>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveLock = useRef(false);
  const tookToken = useRef(false);
  const today = todayISO();

  // Deleted homework is planned with too, so what the student deleted is never imported again.
  // Only this plan sees the tombstones; the store and every other screen stay without them.
  const planWith = (result: ClassroomFetch, d: PlannerData): ClassroomPlan =>
    planClassroomImport(
      result,
      { ...d, homework: [...d.homework, ...repo.tombstones<Homework>('homework')] },
      today,
    );

  const read = async (token: string) => {
    setPhase('reading');
    try {
      const result = await fetchClassroom(token);
      const next = planWith(result, data);
      setFetched(result);
      setPlan(next);
      setChoices(
        Object.fromEntries(
          next.unlinkedCourses
            .filter((c) => c.suggestion !== null)
            .map((c) => [c.id, c.suggestion as string]),
        ),
      );
      setPhase(next.unlinkedCourses.length > 0 ? 'link' : 'review');
    } catch (e) {
      setError(messageOf(e));
      setPhase('start');
    }
  };

  const connect = async () => {
    setError(null);
    setPhase('reading');
    try {
      const token = await getClassroomToken();
      if (token === 'redirecting') return;
      await read(token);
    } catch (e) {
      setError(messageOf(e));
      setPhase('start');
    }
  };

  // A Classroom sign-in by redirect (installed app) comes back here with a token waiting.
  useEffect(() => {
    if (tookToken.current) return;
    tookToken.current = true;
    void (async () => {
      try {
        const token = await takeClassroomToken();
        if (token !== null) await read(token);
      } catch (e) {
        setError(messageOf(e));
        setPhase('start');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subjects = useMemo(
    () =>
      data.subjects
        .filter((s) => !s.deleted && s.attending)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.subjects],
  );

  const carryOn = (): void => {
    if (plan === null) return;
    const made: ClassroomCourse[] = plan.unlinkedCourses.map((c) => {
      const existing = data.classroomCourses.find((x) => x.id === c.id);
      const pick = choices[c.id];
      return {
        id: c.id,
        name: c.name,
        subjectId: pick === SKIP ? null : pick,
        updatedAt: existing ? stamp(existing) : Date.now(),
      };
    });
    const merged: PlannerData = {
      ...data,
      classroomCourses: [
        ...data.classroomCourses.filter((x) => !made.some((m) => m.id === x.id)),
        ...made,
      ],
    };
    if (fetched === null) return;
    setLinks(made);
    setPlan(planWith(fetched, merged));
    setPhase('review');
  };

  if (phase === 'reading') {
    return (
      <FormScreen title={TITLE}>
        <Text>Reading Classroom…</Text>
      </FormScreen>
    );
  }

  if (phase === 'start' || plan === null) {
    return (
      <FormScreen title={TITLE}>
        <Text>
          Adds your Google Classroom assignments to Homework. Nothing is saved until you tap Save.
        </Text>
        {error !== null ? (
          <>
            <Text accessibilityRole="alert" style={styles.warning}>
              {error}
            </Text>
            <Button label="Try again" onPress={() => void connect()} />
          </>
        ) : (
          <>
            <Button label="Connect to Classroom" onPress={() => void connect()} />
            <Text variant="meta">You can choose any Google account, like your university one.</Text>
          </>
        )}
      </FormScreen>
    );
  }

  if (phase === 'link') {
    const ready = plan.unlinkedCourses.every((c) => choices[c.id] !== undefined);
    return (
      <FormScreen title={TITLE}>
        <Text variant="title">Which subject is each course?</Text>
        <Rule weight="heavy" />
        {plan.unlinkedCourses.map((c) => (
          <Chips
            key={c.id}
            label={c.name}
            options={[
              ...subjects.map((s) => ({ value: s.id, label: s.name })),
              { value: SKIP, label: 'Don’t import' },
            ]}
            value={choices[c.id] ?? null}
            onChange={(v) => setChoices((all) => ({ ...all, [c.id]: v }))}
          />
        ))}
        <Button label="Continue" disabled={!ready} onPress={carryOn} />
      </FormScreen>
    );
  }

  const actionable = plan.items.filter((i) => i.action !== 'unchanged');
  const nothing = actionable.length === 0;
  const added = actionable.filter((i) => i.action === 'new').length;
  const updated = actionable.filter((i) => i.action === 'update').length;
  const open = actionable.filter(
    (i) => i.action === 'conflict' && conflicts[i.workId] === undefined,
  );
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name ?? '';
  const groups: { subjectId: string; items: ClassroomItem[] }[] = [];
  for (const item of actionable) {
    const last = groups[groups.length - 1];
    if (last && last.subjectId === item.subjectId) last.items.push(item);
    else groups.push({ subjectId: item.subjectId, items: [item] });
  }

  const save = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const result = applyClassroomImport(plan, { conflicts }, links, data, Date.now(), newId);
      for (const c of result.courses) await repo.upsert('classroomCourses', c);
      for (const h of result.homework) await repo.upsert('homework', h);
      router.replace('/homework');
    } catch {
      setSaveFailed(true);
      saveLock.current = false;
      setSaving(false);
    }
  };

  const canSave = !saving && open.length === 0 && (!nothing || links.length > 0);
  return (
    <FormScreen title={TITLE}>
      {nothing ? (
        <Text>Everything from Classroom is already in your homework.</Text>
      ) : (
        <Text variant="meta">{`${added} new, ${updated} updated`}</Text>
      )}
      {groups.map((g) => (
        <View key={g.subjectId} style={styles.group}>
          <Text variant="title">{subjectName(g.subjectId)}</Text>
          <Rule weight="heavy" />
          {g.items.map((item) => (
            <Row
              key={item.workId}
              item={item}
              today={today}
              choice={conflicts[item.workId] ?? null}
              onChoice={(v) => setConflicts((all) => ({ ...all, [item.workId]: v }))}
            />
          ))}
        </View>
      ))}
      <View style={styles.group}>
        <Rule weight="heavy" />
        <Button
          label={nothing && links.length === 0 ? 'Nothing to add' : 'Save'}
          disabled={!canSave}
          onPress={() => void save()}
        />
        {open.length > 0 ? (
          <Text variant="meta">
            {open.length === 1
              ? 'Choose for the conflict above to save.'
              : `Choose for the ${open.length} conflicts above to save.`}
          </Text>
        ) : null}
        {saveFailed ? <Text style={styles.warning}>Couldn’t save. Try again.</Text> : null}
      </View>
    </FormScreen>
  );
}

function Row({
  item,
  today,
  choice,
  onChoice,
}: {
  item: ClassroomItem;
  today: string;
  choice: 'mine' | 'classroom' | null;
  onChoice: (v: 'mine' | 'classroom') => void;
}) {
  const ex = item.existing;
  const conflict = item.action === 'conflict' && ex !== undefined;
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{conflict ? ex.title : item.title}</Text>
      <View style={styles.meta}>
        <Text variant="meta">{dueText(item.due, item.dueTime, today)}</Text>
        {item.done ? <Text variant="meta">Done</Text> : null}
        {item.action === 'new' ? <Text style={styles.tag}>New</Text> : null}
        {item.action === 'update' ? <Text style={styles.tag}>Updated</Text> : null}
      </View>
      {conflict ? (
        <>
          <Text style={styles.warning}>You changed this, and Classroom changed it too.</Text>
          <Text variant="meta">
            {`Yours: ${ex.title}, ${dueText(ex.due, ex.dueTime, today)} · Classroom: ${item.title}, ${dueText(item.due, item.dueTime, today)}`}
          </Text>
          <Chips
            label="Which to keep"
            options={[
              { value: 'mine' as const, label: 'Keep mine' },
              { value: 'classroom' as const, label: 'Use Classroom’s' },
            ]}
            value={choice}
            onChange={onChoice}
          />
        </>
      ) : null}
      <Rule weight="hair" />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.space(3) },
  row: { gap: theme.space(2), paddingTop: theme.space(2) },
  rowTitle: { fontFamily: theme.font.appBold },
  meta: { flexDirection: 'row', gap: theme.space(3), flexWrap: 'wrap' },
  tag: { fontFamily: theme.font.appBold, fontSize: 13, color: theme.color.ink },
  warning: { color: theme.color.now, fontFamily: theme.font.appBold },
});
