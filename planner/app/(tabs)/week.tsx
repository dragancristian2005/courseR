import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { saveChangeEveryWeek, saveMoveThisWeek } from '../../src/data/sessionEdits';
import { useStore } from '../../src/data/useStore';
import { addDays, mondayOf, todayISO, weekdayOf } from '../../src/domain/dates';
import { droppedByChange } from '../../src/domain/edits';
import { sessionsWithCancelled } from '../../src/domain/sessions';
import type { ISODate, Session } from '../../src/domain/types';
import { weekFor } from '../../src/domain/weeks';
import { droppedWarning } from '../../src/ui/ChangeForm';
import { ClassDetail } from '../../src/ui/ClassDetail';
import { DropBar } from '../../src/ui/DropBar';
import { Rule } from '../../src/ui/Rule';
import { SetupPrompt } from '../../src/ui/SetupPrompt';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';
import { useLayout } from '../../src/ui/useLayout';
import { useNow } from '../../src/ui/useNow';
import { MONTHS_LONG, WEEKDAYS_SHORT } from '../../src/ui/format';
import type { DropTarget } from '../../src/ui/weekDrag';
import { lastShownDay, WeekGrid } from '../../src/ui/WeekGrid';

const dayMonth = (d: ISODate) => {
  const [, m, day] = d.split('-').map(Number);
  return { day, month: MONTHS_LONG[m - 1] };
};

function rangeLabel(from: ISODate, to: ISODate): string {
  const a = dayMonth(from);
  const b = dayMonth(to);
  return a.month === b.month
    ? `${a.day} to ${b.day} ${b.month}`
    : `${a.day} ${a.month} to ${b.day} ${b.month}`;
}

interface Drop {
  session: Session;
  target: DropTarget;
  /** Set when Every week would drop one-off changes or notes, until confirmed. */
  warning?: string;
  failure?: string;
}

export default function WeekScreen() {
  const layout = useLayout();
  const now = useNow();
  const { data, repo } = useStore();
  const [offset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);
  const [drop, setDrop] = useState<Drop | undefined>();
  const setOffset = (f: number | ((o: number) => number)) => {
    setDrop(undefined);
    setWeekOffset(f);
  };

  const today = todayISO(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const monday = addDays(mondayOf(today), offset * 7);
  const week = data.semester ? weekFor(data.semester, monday) : null;
  const generated = sessionsWithCancelled(data, monday, addDays(monday, 6));
  const sessions = generated.map((g) => g.session);
  const cancelledIds = new Set(generated.filter((g) => g.cancelled).map((g) => g.session.id));
  const end = addDays(monday, lastShownDay(sessions, monday) - 1);
  const wide = layout === 'wide';

  const title = !week ? 'Week' : week.isBreak ? 'Break' : `Week ${week.number}`;
  const kind = !week ? 'outside the semester' : week.isBreak ? 'break' : `${week.parity} week`;
  const needsSetup = !data.semester || data.patterns.length === 0;

  const open = (s: Session) =>
    router.push({
      pathname: '/class/[sessionId]',
      params: { sessionId: s.id },
    });
  const onPressSession = (s: Session) => (wide ? setSelectedId(s.id) : open(s));
  const selected = sessions.find((s) => s.id === selectedId);

  const subjectName = (s: Session) =>
    data.subjects.find((x) => x.id === s.subjectId)?.name ?? 'class';
  const question = drop
    ? `Move ${subjectName(drop.session)} to ${WEEKDAYS_SHORT[weekdayOf(drop.target.date) - 1]} ${drop.target.start}?`
    : '';
  const thisWeek = () => {
    if (!drop) return;
    const { session, target } = drop;
    saveMoveThisWeek(repo, data, session, {
      ...target,
      ...(session.online ? {} : { room: session.room }),
    });
    setDrop(undefined);
  };
  // Every week changes the class from the shown week's Monday on, as Change every week would.
  // It is only offered for a class that belongs to the shown week: one moved in from, or out to,
  // another week can only be moved just this week.
  const originalWeek = (s: Session) => mondayOf(s.id.slice(s.id.lastIndexOf(':') + 1));
  const canChangeEveryWeek = drop ? originalWeek(drop.session) === monday : false;
  const saveEveryWeek = () => {
    if (!drop || !canChangeEveryWeek) return;
    const { session, target } = drop;
    const pattern = data.patterns.find((p) => p.id === session.patternId);
    if (!pattern) return setDrop(undefined);
    try {
      const moved = saveChangeEveryWeek(
        repo,
        data,
        pattern,
        monday,
        { weekday: weekdayOf(target.date), start: target.start, end: target.end },
        target.date,
        // A pattern that starts mid-week still gets the class in this week.
        { startAtFrom: true },
      );
      if (selectedId === session.id) setSelectedId(moved?.id);
      setDrop(undefined);
    } catch (e) {
      setDrop({
        ...drop,
        warning: undefined,
        failure: e instanceof Error ? e.message : 'Could not save the change.',
      });
    }
  };
  const everyWeek = () => {
    if (!drop || !canChangeEveryWeek) return;
    const from = monday;
    const dropped = droppedByChange(data, drop.session.patternId, from);
    if (dropped.overrides.length + dropped.notes.length > 0)
      setDrop({ ...drop, warning: droppedWarning(dropped, from), failure: undefined });
    else saveEveryWeek();
  };

  let body: React.ReactNode;
  if (needsSetup) body = <SetupPrompt data={data} />;
  else if (week?.isBreak && sessions.length === 0)
    body = <Text style={styles.plain}>No classes this week, it’s a break.</Text>;
  else
    body = (
      <WeekGrid
        sessions={sessions}
        subjects={data.subjects}
        monday={monday}
        today={today}
        nowMinutes={nowMinutes}
        onPressSession={onPressSession}
        density={wide ? 'full' : 'compact'}
        selectedSessionId={wide ? selectedId : undefined}
        cancelledIds={cancelledIds}
        onDropSession={(session, target) => setDrop({ session, target })}
        onDragChange={setDragging}
        pendingDrop={drop ? { sessionId: drop.session.id, target: drop.target } : undefined}
        dropRange={
          data.semester ? { from: data.semester.firstDay, to: data.semester.lastDay } : undefined
        }
      />
    );

  return (
    <View style={styles.screen}>
      <View style={styles.main}>
        <ScrollView
          testID="week-scroll"
          style={styles.main}
          contentContainerStyle={styles.content}
          scrollEnabled={!dragging}
        >
          <View style={styles.inner}>
            {needsSetup ? null : (
              <>
                <View style={styles.headerRow}>
                  <View style={styles.titles}>
                    <Text style={styles.title}>{title}</Text>
                    <Text variant="meta">{`${rangeLabel(monday, end)}, ${kind}`}</Text>
                    {offset !== 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="This week"
                        onPress={() => setOffset(0)}
                        style={styles.thisWeek}
                      >
                        <Text style={styles.thisWeekText}>This week</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.nav}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Previous week"
                      onPress={() => setOffset((o) => o - 1)}
                      style={styles.navButton}
                    >
                      <Text style={styles.navText}>‹</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Next week"
                      onPress={() => setOffset((o) => o + 1)}
                      style={styles.navButton}
                    >
                      <Text style={styles.navText}>›</Text>
                    </Pressable>
                  </View>
                </View>
                <Rule weight="heavy" />
              </>
            )}
            {body}
          </View>
        </ScrollView>
        {drop ? (
          <DropBar
            question={question}
            warning={drop.warning}
            failure={drop.failure}
            onThisWeek={thisWeek}
            onEveryWeek={canChangeEveryWeek ? everyWeek : undefined}
            onCancel={() => setDrop(undefined)}
            onSaveAnyway={saveEveryWeek}
            onGoBack={() => setDrop({ ...drop, warning: undefined })}
          />
        ) : null}
      </View>
      {wide && !needsSetup ? (
        <View style={styles.panel}>
          {selected ? (
            <ScrollView>
              <ClassDetail
                key={selected.id}
                sessionId={selected.id}
                onClose={() => setSelectedId(undefined)}
                onOpenSession={setSelectedId}
              />
            </ScrollView>
          ) : (
            <Text style={styles.panelEmpty}>Select a class to see its details.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: theme.color.paper },
  main: { flex: 1 },
  content: { padding: theme.space(4), paddingTop: 0, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 1100 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: theme.space(2),
  },
  titles: { flex: 1 },
  title: {
    fontFamily: theme.font.appBold,
    fontSize: 30,
    color: theme.color.ink,
  },
  thisWeek: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  thisWeekText: {
    fontFamily: theme.font.appBold,
    textDecorationLine: 'underline',
  },
  nav: { flexDirection: 'row', gap: theme.space(2) },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  navText: { fontFamily: theme.font.appBold, fontSize: 24, lineHeight: 28 },
  plain: { paddingVertical: theme.space(4) },
  panel: {
    width: 320,
    borderLeftWidth: 2,
    borderLeftColor: theme.color.ink,
    backgroundColor: theme.color.paper,
  },
  panelEmpty: { padding: theme.space(4) },
});
