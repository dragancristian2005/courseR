import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  liveOverrideOf,
  overrideStamp,
  saveChangeEveryWeek,
  saveMoveThisWeek,
} from '../data/sessionEdits';
import { useStore } from '../data/useStore';
import { todayISO } from '../domain/dates';
import { cancelThisWeek, changeEveryWeek, droppedByChange, stamp } from '../domain/edits';
import { dueLabel, homeworkGroups, linksBySubject, notesFor } from '../domain/selectors';
import { resolveSession } from '../domain/sessions';
import type { ISODate, Repeat } from '../domain/types';
import { weekFor } from '../domain/weeks';
import { goBack } from './BackLink';
import { leaveTo } from './leaveImport';
import { Button } from './Button';
import { ChangeForm, REPEAT_OPTIONS } from './ChangeForm';
import { longDate, shortDate, TYPE_LABEL } from './format';
import { MoveForm } from './MoveForm';
import { openLink } from './openLink';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme, typeFill } from './theme';
import { useNow } from './useNow';

const repeatLabel = (r: Repeat) => REPEAT_OPTIONS.find((o) => o.value === r)!.label;

type Mode = 'none' | 'move' | 'change' | 'cancel' | 'delete';

function TextButton({
  label,
  onPress,
  urgent,
}: {
  label: string;
  onPress: () => void;
  urgent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.textButton}
    >
      <Text style={[styles.textButtonLabel, urgent && { color: theme.color.now }]}>{label}</Text>
    </Pressable>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Rule weight="heavy" />
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function ClassDetail({
  sessionId,
  onClose,
  onOpenSession,
}: {
  sessionId: string;
  /** Called instead of navigating back or home (used when shown inside the Week panel). */
  onClose?: () => void;
  /** Called instead of navigating to another class (used when shown inside the Week panel). */
  onOpenSession?: (id: string) => void;
}) {
  const { data, repo } = useStore();
  const now = useNow();
  const [mode, setMode] = useState<Mode>('none');
  const today = todayISO(now);
  const resolved = resolveSession(data, sessionId);
  const session = resolved?.session;
  const cancelled = resolved?.cancelled ?? false;
  const pattern = session ? data.patterns.find((p) => p.id === session.patternId) : undefined;
  const subject = session ? data.subjects.find((s) => s.id === session.subjectId) : undefined;
  const leave = () => (onClose ? onClose() : goBack());
  const home = () => (onClose ? onClose() : router.replace('/'));

  if (!session || !pattern || !subject) {
    return (
      <View style={styles.missing}>
        <Text>This class is no longer in your timetable.</Text>
        <Button label="Back to today" onPress={home} />
      </View>
    );
  }

  const originalDate = session.id.slice(session.id.lastIndexOf(':') + 1);
  const override = liveOverrideOf(data, session.id);
  const type = TYPE_LABEL[session.type];
  const links =
    linksBySubject(data).bySubject.find((x) => x.subject.id === subject.id)?.links ?? [];
  const groups = homeworkGroups(data, today);
  const homework = [...groups.thisWeek, ...groups.later, ...groups.noDue].filter(
    (h) => h.subjectId === subject.id,
  );
  const notes = notesFor(data, { sessionId: session.id });
  const q = `subjectId=${encodeURIComponent(subject.id)}`;

  const week = data.semester ? weekFor(data.semester, session.date) : null;
  const weekRow = !week
    ? null
    : week.isBreak
      ? 'Break'
      : `Week ${week.number}, ${week.parity} week`;

  const rows: [string, string][] = [
    ['Time', `${session.start} to ${session.end}`],
    ['Room', session.online ? 'Online' : session.room],
    ...(session.teacher ? ([['Teacher', session.teacher]] as [string, string][]) : []),
    ['Repeats', repeatLabel(pattern.repeat)],
    ...(weekRow ? ([['Week', weekRow]] as [string, string][]) : []),
  ];

  const saveChange = (from: ISODate, changes: Parameters<typeof changeEveryWeek>[2]) => {
    const target = saveChangeEveryWeek(repo, data, pattern, from, changes);
    setMode('none');
    if (!target) return leave();
    if (onOpenSession) onOpenSession(target.id);
    else
      router.replace({
        pathname: '/class/[sessionId]',
        params: { sessionId: target.id },
      });
  };

  return (
    <View>
      <View style={[styles.head, { backgroundColor: typeFill(session.type) }]}>
        <Text style={styles.name}>{subject.name}</Text>
        <Text>{`${type}, ${longDate(session.date)}`}</Text>
      </View>
      <Rule weight="heavy" />
      <View>
        {rows.map(([label, value]) => (
          <View key={label}>
            <View style={styles.defRow}>
              <Text variant="meta" style={styles.defLabel}>
                {label}
              </Text>
              <Text variant={label === 'Time' ? 'time' : 'body'} style={styles.defValue}>
                {value}
              </Text>
            </View>
            <Rule weight="hair" />
          </View>
        ))}
      </View>

      {cancelled ? (
        <View style={styles.moved}>
          <Text style={styles.cancelledNote}>Cancelled this week</Text>
          {override ? (
            <Button
              label="Undo cancellation"
              kind="outline"
              onPress={() => void repo.remove('overrides', override.id)}
            />
          ) : null}
        </View>
      ) : null}

      {session.moved ? (
        <View style={styles.moved}>
          <Text>{`Moved from ${shortDate(originalDate)}, ${pattern.start}`}</Text>
          {override ? (
            <Button
              label="Undo this week’s change"
              kind="outline"
              onPress={() => void repo.remove('overrides', override.id)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {cancelled ? null : (
          <View style={styles.flex}>
            <Button
              label="Move this week"
              kind="outline"
              onPress={() => setMode(mode === 'move' ? 'none' : 'move')}
            />
          </View>
        )}
        {cancelled ? null : (
          <View style={styles.flex}>
            <Button
              label="Change every week"
              kind="outline"
              onPress={() => setMode(mode === 'change' ? 'none' : 'change')}
            />
          </View>
        )}
      </View>

      {mode === 'move' ? (
        <MoveForm
          session={session}
          onCancel={() => setMode('none')}
          onSave={(to) => {
            saveMoveThisWeek(repo, data, session, to);
            setMode('none');
          }}
        />
      ) : null}
      {mode === 'change' && !cancelled ? (
        <ChangeForm
          pattern={pattern}
          defaultFrom={originalDate}
          dropFor={(from) => droppedByChange(data, pattern.id, from)}
          onCancel={() => setMode('none')}
          onSave={saveChange}
        />
      ) : null}

      {cancelled ? null : mode === 'cancel' ? (
        <View style={styles.confirm}>
          <Text>{`Cancel this class on ${longDate(session.date)}?`}</Text>
          <View style={styles.buttons}>
            <Button
              label="Cancel class"
              onPress={() => {
                void repo.upsert(
                  'overrides',
                  cancelThisWeek(session, overrideStamp(repo, data, session)),
                );
                leave();
              }}
            />
            <Button label="Keep it" kind="outline" onPress={() => setMode('none')} />
          </View>
        </View>
      ) : (
        <TextButton label="Cancel this week’s class" onPress={() => setMode('cancel')} />
      )}

      <Section
        title="Links"
        right={<TextButton label="Add link" onPress={() => router.push(`/link/edit?${q}`)} />}
      >
        {links.length === 0 ? <Text variant="meta">No links yet.</Text> : null}
        {links.map((l) => (
          <View key={l.id}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={l.title}
              onPress={() => openLink(l.url)}
              style={styles.row}
            >
              <Text style={styles.rowTitle}>{l.title}</Text>
              <Text>↗</Text>
            </Pressable>
            <Rule weight="hair" />
          </View>
        ))}
      </Section>

      <Section
        title="Homework"
        right={
          <TextButton label="Add homework" onPress={() => router.push(`/homework/edit?${q}`)} />
        }
      >
        {homework.length === 0 ? <Text variant="meta">No homework for this subject.</Text> : null}
        {homework.map((h) => {
          const label = dueLabel(h.due, today);
          const urgent = label === 'Overdue' || label === 'Today' || label === 'Tomorrow';
          return (
            <View key={h.id}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: h.done }}
                  accessibilityLabel={h.title}
                  onPress={() =>
                    void repo.upsert('homework', {
                      ...h,
                      done: true,
                      updatedAt: stamp(h),
                    })
                  }
                  style={styles.checkHit}
                >
                  <View style={styles.checkbox} />
                </Pressable>
                <Text style={styles.rowTitle}>{h.title}</Text>
                {label ? (
                  <Text variant="meta" style={urgent ? styles.urgent : undefined}>
                    {label}
                  </Text>
                ) : null}
              </View>
              <Rule weight="hair" />
            </View>
          );
        })}
      </Section>

      <Section
        title={`Notes from this ${type.toLowerCase()}`}
        right={
          <TextButton
            label={`All ${subject.abbreviation} notes`}
            onPress={() => router.push(`/notes?${q}`)}
          />
        }
      >
        {notes.length === 0 ? <Text variant="meta">No notes yet.</Text> : null}
        {notes.map((n) => (
          <View key={n.id} style={styles.note}>
            <Text variant="note">{n.text}</Text>
          </View>
        ))}
        <TextButton
          label="Add a note"
          onPress={() => router.push(`/note/edit?sessionId=${encodeURIComponent(session.id)}&${q}`)}
        />
      </Section>

      <View style={styles.section}>
        <Rule weight="hair" />
        {mode === 'delete' ? (
          <View style={styles.confirm}>
            <Text>
              This removes the class from every week, including past weeks. Your notes stay in
              Notes.
            </Text>
            <View style={styles.buttons}>
              <Button
                label="Delete class"
                onPress={() => {
                  void repo.remove('patterns', pattern.id);
                  if (onClose) onClose();
                  // Opened from Week (or Today) on a phone: land on Today, not the tab underneath.
                  else leaveTo('/');
                }}
              />
              <Button label="Keep it" kind="outline" onPress={() => setMode('none')} />
            </View>
          </View>
        ) : (
          <TextButton label="Delete class" urgent onPress={() => setMode('delete')} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: {
    padding: theme.space(4),
    gap: theme.space(3),
    alignItems: 'flex-start',
  },
  head: { padding: theme.space(4), gap: theme.space(1) },
  name: {
    fontFamily: theme.font.appBold,
    fontSize: 28,
    color: theme.color.ink,
  },
  defRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: theme.space(4),
  },
  defLabel: { width: 90 },
  defValue: { flex: 1 },
  cancelledNote: { fontFamily: theme.font.appBold, color: theme.color.now },
  moved: {
    padding: theme.space(4),
    gap: theme.space(2),
    alignItems: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space(3),
    padding: theme.space(4),
  },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: theme.space(3), flexWrap: 'wrap' },
  confirm: { gap: theme.space(3), padding: theme.space(4) },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space(4),
  },
  textButtonLabel: {
    fontFamily: theme.font.appBold,
    textDecorationLine: 'underline',
  },
  section: { paddingHorizontal: 0, marginTop: theme.space(3) },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: theme.space(4),
  },
  sectionTitle: {
    fontFamily: theme.font.appBold,
    fontSize: 18,
    color: theme.color.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: theme.space(4),
    gap: theme.space(2),
  },
  rowTitle: { flex: 1 },
  checkHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -theme.space(3),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  urgent: { color: theme.color.now, fontFamily: theme.font.appBold },
  note: { paddingHorizontal: theme.space(4), paddingVertical: theme.space(2) },
});
