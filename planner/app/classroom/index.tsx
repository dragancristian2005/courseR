import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ClassroomError,
  fetchClassroom,
  getClassroomToken,
  prepareClassroomSignIn,
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
import { TextButton } from '../../src/ui/TextButton';
import { theme } from '../../src/ui/theme';

const SKIP = 'skip';
const TITLE = 'Import from Classroom';
const NO_COURSES =
  'This Google account has no Classroom courses. Try again and choose your university account.';

type Phase = 'start' | 'reading' | 'redirecting' | 'link' | 'review';
type Course = { id: string; name: string };

const messageOf = (e: unknown): string =>
  e instanceof ClassroomError ? e.message : 'Something went wrong reading Classroom. Try again.';

const dueText = (due: string | null, time: string | null, today: string): string => {
  if (due === null) return 'No due date';
  const label = dueLabel(due, today);
  return time === null ? label : `${label} ${time}`;
};

const failedText = (names: string[]): string =>
  names.length === 1
    ? `Couldn’t read 1 course: ${names[0]}.`
    : `Couldn’t read ${names.length} courses: ${names.join(', ')}.`;

type BrowserWindow = {
  addEventListener?: (type: string, fn: (e: { persisted?: boolean }) => void) => void;
  removeEventListener?: (type: string, fn: (e: { persisted?: boolean }) => void) => void;
};

export default function ClassroomImport() {
  const { data, repo } = useStore();
  const [phase, setPhase] = useState<Phase>('start');
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<ClassroomFetch | null>(null);
  const [plan, setPlan] = useState<ClassroomPlan | null>(null);
  /** Course links chosen in the link step, saved together with the homework. */
  const [links, setLinks] = useState<ClassroomCourse[]>([]);
  /** Courses shown in the link step. */
  const [linking, setLinking] = useState<Course[]>([]);
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

  /** Saved links, overlaid with the ones chosen in this import. */
  const currentLinks = (pending: ClassroomCourse[]): Map<string, ClassroomCourse> => {
    const out = new Map<string, ClassroomCourse>();
    for (const c of data.classroomCourses) if (!c.deleted) out.set(c.id, c);
    for (const c of pending) out.set(c.id, c);
    return out;
  };

  // Preselects: the course's current link; else the suggested subject; else Don't import when
  // the course has nothing to import; else nothing, so the student chooses.
  const openLinks = (courses: Course[], basis: ClassroomPlan, pending: ClassroomCourse[]) => {
    const unlinked = new Map(basis.unlinkedCourses.map((c) => [c.id, c]));
    const current = currentLinks(pending);
    const preset: Record<string, string> = {};
    for (const c of courses) {
      const u = unlinked.get(c.id);
      const link = current.get(c.id);
      if (u !== undefined) {
        if (u.suggestion !== null) preset[c.id] = u.suggestion;
        else if (!u.importable) preset[c.id] = SKIP;
      } else if (link !== undefined) {
        preset[c.id] = link.subjectId ?? SKIP;
      }
    }
    setLinking(courses);
    setChoices(preset);
    setPhase('link');
  };

  const read = async (token: string) => {
    setPhase('reading');
    try {
      const result = await fetchClassroom(token);
      if (result.courses.length === 0) {
        setError(NO_COURSES);
        setPhase('start');
        return;
      }
      const next = planWith(result, data);
      setFetched(result);
      setPlan(next);
      setLinks([]);
      setConflicts({});
      if (next.unlinkedCourses.length > 0) openLinks(next.unlinkedCourses, next, []);
      else setPhase('review');
    } catch (e) {
      setError(messageOf(e));
      setPhase('start');
    }
  };

  // Called straight from the tap: getClassroomToken opens the Google window before awaiting
  // anything, which Safari requires.
  const connect = async () => {
    setError(null);
    setPhase('reading');
    try {
      const token = await getClassroomToken();
      if (token === 'redirecting') {
        setPhase('redirecting');
        return;
      }
      await read(token);
    } catch (e) {
      setError(messageOf(e));
      setPhase('start');
    }
  };

  const takeToken = async () => {
    try {
      const token = await takeClassroomToken();
      if (token !== null) await read(token);
    } catch (e) {
      setError(messageOf(e));
      setPhase('start');
    }
  };
  const latestTakeToken = useRef(takeToken);
  latestTakeToken.current = takeToken;

  // A Classroom sign-in by redirect (installed app) comes back here with a token waiting.
  // read() closes over this first render's data; that is fine because the layout mounts this
  // screen only once the store has loaded. The ref keeps StrictMode from taking the token twice.
  useEffect(() => {
    if (tookToken.current) return;
    tookToken.current = true;
    prepareClassroomSignIn();
    void takeToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backing out of Google in the installed app can restore this page from the back-forward
  // cache, still saying "Opening Google…": start over, and pick up a token if one came back.
  useEffect(() => {
    const win = (globalThis as { window?: BrowserWindow }).window;
    if (typeof win?.addEventListener !== 'function') return;
    const onShow = (e: { persisted?: boolean }) => {
      if (!e.persisted) return;
      setError(null);
      setPhase('start');
      void latestTakeToken.current();
    };
    win.addEventListener('pageshow', onShow);
    return () => win.removeEventListener?.('pageshow', onShow);
  }, []);

  const subjects = useMemo(
    () =>
      data.subjects
        .filter((s) => !s.deleted && s.attending)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.subjects],
  );

  const carryOn = (): void => {
    if (plan === null || fetched === null) return;
    const pending = new Map(links.map((c) => [c.id, c]));
    for (const c of linking) {
      const pick = choices[c.id];
      const subjectId = pick === SKIP ? null : pick;
      const saved = data.classroomCourses.find((x) => x.id === c.id);
      pending.delete(c.id);
      if (saved && saved.subjectId === subjectId && saved.name === c.name) continue;
      pending.set(c.id, {
        id: c.id,
        name: c.name,
        subjectId,
        updatedAt: saved ? stamp(saved) : Date.now(),
      });
    }
    const made = Array.from(pending.values());
    const merged: PlannerData = {
      ...data,
      classroomCourses: [...data.classroomCourses.filter((x) => !pending.has(x.id)), ...made],
    };
    setLinks(made);
    setPlan(planWith(fetched, merged));
    setPhase('review');
  };

  if (phase === 'reading' || phase === 'redirecting') {
    return (
      <FormScreen title={TITLE}>
        <Text>{phase === 'reading' ? 'Reading Classroom…' : 'Opening Google…'}</Text>
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
    const ready = linking.every((c) => choices[c.id] !== undefined);
    const current = currentLinks(links);
    return (
      <FormScreen title={TITLE}>
        <Text variant="title">Which subject is each course?</Text>
        <Rule weight="heavy" />
        {linking.map((c) => {
          // A course linked to a subject that is switched off keeps that subject as an option.
          const linked = current.get(c.id)?.subjectId;
          const off = data.subjects.find(
            (s) => s.id === linked && !s.deleted && !subjects.some((x) => x.id === s.id),
          );
          return (
            <Chips
              key={c.id}
              label={c.name}
              options={[
                ...[...subjects, ...(off ? [off] : [])].map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
                { value: SKIP, label: 'Don’t import' },
              ]}
              value={choices[c.id] ?? null}
              onChange={(v) => setChoices((all) => ({ ...all, [c.id]: v }))}
              onClear={() =>
                setChoices((all) => {
                  const { [c.id]: _cleared, ...rest } = all;
                  return rest;
                })
              }
            />
          );
        })}
        <Button label="Continue" disabled={!ready} onPress={carryOn} />
      </FormScreen>
    );
  }

  // Refresh items only update the stored snapshot: never shown or counted, and they don't
  // enable Save on their own; they are saved with the next real save.
  const actionable = plan.items.filter((i) => i.action !== 'unchanged' && i.action !== 'refresh');
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
      {fetched !== null && fetched.failedCourses.length > 0 ? (
        <Text variant="meta">{failedText(fetched.failedCourses)}</Text>
      ) : null}
      {fetched !== null ? (
        <TextButton
          label="Change course links"
          onPress={() => openLinks(fetched.courses, plan, links)}
        />
      ) : null}
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
