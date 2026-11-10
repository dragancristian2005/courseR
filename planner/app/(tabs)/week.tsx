import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useStore } from '../../src/data/useStore';
import { addDays, mondayOf, todayISO } from '../../src/domain/dates';
import { sessionsWithCancelled } from '../../src/domain/sessions';
import type { ISODate, Session } from '../../src/domain/types';
import { weekFor } from '../../src/domain/weeks';
import { ClassDetail } from '../../src/ui/ClassDetail';
import { Rule } from '../../src/ui/Rule';
import { SetupPrompt } from '../../src/ui/SetupPrompt';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';
import { useLayout } from '../../src/ui/useLayout';
import { useNow } from '../../src/ui/useNow';
import { MONTHS_LONG } from '../../src/ui/format';
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

export default function WeekScreen() {
  const layout = useLayout();
  const now = useNow();
  const { data } = useStore();
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | undefined>();

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
      />
    );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.main} contentContainerStyle={styles.content}>
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
  content: { padding: theme.space(4), paddingTop: theme.space(2), alignItems: 'center' },
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
