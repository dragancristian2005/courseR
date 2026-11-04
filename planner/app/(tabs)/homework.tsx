import { stamp } from '../../src/domain/edits';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStore } from '../../src/data/useStore';
import { todayISO } from '../../src/domain/dates';
import { homeworkGroups } from '../../src/domain/selectors';
import type { Homework } from '../../src/domain/types';
import { HomeworkRow } from '../../src/ui/HomeworkRow';
import { Page, PageHeader, SectionHeading } from '../../src/ui/Page';
import { Text } from '../../src/ui/Text';
import { TextButton } from '../../src/ui/TextButton';
import { theme } from '../../src/ui/theme';
import { useNow } from '../../src/ui/useNow';

export default function HomeworkTab() {
  const { data, repo } = useStore();
  const today = todayISO(useNow());
  const [showDone, setShowDone] = useState(false);
  const groups = homeworkGroups(data, today);
  const total = groups.thisWeek.length + groups.later.length + groups.done.length;

  const toggle = (h: Homework) =>
    void repo.upsert('homework', {
      ...h,
      done: !h.done,
      updatedAt: stamp(h),
    });
  const list = (items: Homework[]) =>
    items.map((h) => (
      <HomeworkRow
        key={h.id}
        hw={h}
        today={today}
        subject={data.subjects.find((s) => s.id === h.subjectId && !s.deleted)}
        onToggle={() => toggle(h)}
      />
    ));

  return (
    <Page>
      <PageHeader
        title="Homework"
        actionLabel="Add homework"
        onAction={() => router.push('/homework/edit')}
      />
      {total === 0 ? (
        <Text style={styles.empty}>Nothing due. Add homework when you get it.</Text>
      ) : (
        <>
          {groups.thisWeek.length > 0 ? (
            <>
              <SectionHeading>This week</SectionHeading>
              {list(groups.thisWeek)}
            </>
          ) : null}
          {groups.later.length > 0 ? (
            <>
              <SectionHeading>Later</SectionHeading>
              {list(groups.later)}
            </>
          ) : null}
          {groups.done.length > 0 ? (
            <View style={styles.done}>
              <TextButton
                label={`Done (${groups.done.length}) ›`}
                expanded={showDone}
                onPress={() => setShowDone((v) => !v)}
              />
              {showDone ? list(groups.done) : null}
            </View>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: theme.space(4), color: theme.color.muted },
  done: { paddingTop: theme.space(4) },
});
