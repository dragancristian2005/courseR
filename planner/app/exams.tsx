import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStore } from '../src/data/useStore';
import { compareDates, daysBetween, todayISO } from '../src/domain/dates';
import type { Exam } from '../src/domain/types';
import { daysCount, shortDate } from '../src/ui/format';
import { Page, PageHeader, SectionHeading } from '../src/ui/Page';
import { Rule } from '../src/ui/Rule';
import { Text } from '../src/ui/Text';
import { theme } from '../src/ui/theme';
import { useNow } from '../src/ui/useNow';

const byWhen = (a: Exam, b: Exam) =>
  compareDates(a.date, b.date) || (a.start ?? '').localeCompare(b.start ?? '');

export default function Exams() {
  const { data } = useStore();
  const today = todayISO(useNow());
  const all = data.exams.filter((e) => !e.deleted);
  const upcoming = all.filter((e) => compareDates(e.date, today) >= 0).sort(byWhen);
  const past = all.filter((e) => compareDates(e.date, today) < 0).sort((a, b) => byWhen(b, a));

  const row = (e: Exam, isPast: boolean) => {
    const subject = data.subjects.find((s) => s.id === e.subjectId && !s.deleted);
    const when = [shortDate(e.date), e.start, e.room ? `room ${e.room}` : null]
      .filter(Boolean)
      .join(', ');
    return (
      <View key={e.id}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${e.title}`}
          onPress={() => router.push(`/exam/edit?id=${e.id}`)}
          style={styles.row}
        >
          <View style={styles.main}>
            <Text testID="exam-title" style={isPast ? styles.muted : styles.title}>
              {e.title}
            </Text>
            {subject ? <Text variant="meta">{subject.name}</Text> : null}
            <Text style={styles.muted}>{when}</Text>
          </View>
          {isPast ? null : (
            <Text style={styles.count}>{daysCount(daysBetween(today, e.date))}</Text>
          )}
        </Pressable>
        <Rule />
      </View>
    );
  };

  return (
    <Page>
      <PageHeader title="Exams" actionLabel="Add exam" onAction={() => router.push('/exam/edit')} />
      {all.length === 0 ? (
        <Text style={styles.empty}>No exams yet. Add one when the dates are out.</Text>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <>
              <SectionHeading>Upcoming</SectionHeading>
              {upcoming.map((e) => row(e, false))}
            </>
          ) : null}
          {past.length > 0 ? (
            <>
              <SectionHeading>Past</SectionHeading>
              {past.map((e) => row(e, true))}
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: theme.space(4), color: theme.color.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space(3),
    minHeight: 64,
    paddingVertical: theme.space(2),
  },
  main: { flex: 1 },
  title: { fontFamily: theme.font.appBold },
  muted: { color: theme.color.muted },
  count: {
    fontFamily: theme.font.appBold,
    fontSize: 22,
    color: theme.color.ink,
  },
});
