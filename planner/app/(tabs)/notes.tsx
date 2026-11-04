import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useStore } from '../../src/data/useStore';
import { notesFor } from '../../src/domain/selectors';
import type { Note, PlannerData } from '../../src/domain/types';
import { ageLabel, fold, sessionRef, shortDate } from '../../src/ui/format';
import { NoteRow } from '../../src/ui/NoteRow';
import { Page, PageHeader } from '../../src/ui/Page';
import { Text } from '../../src/ui/Text';
import { TextButton } from '../../src/ui/TextButton';
import { theme } from '../../src/ui/theme';
import { useNow } from '../../src/ui/useNow';

/** The link line split into a bold lead (abbreviation) and the muted rest. */
function linkLine(
  data: PlannerData,
  n: Note,
): { lead?: string; rest: string; subjectText: string } {
  const ref = sessionRef(data, n.sessionId);
  const subject = ref?.subject ?? data.subjects.find((s) => s.id === n.subjectId && !s.deleted);
  if (ref?.subject) {
    return {
      lead: ref.subject.abbreviation,
      rest: `, ${ref.pattern.type} on ${shortDate(ref.date)}`,
      subjectText: `${ref.subject.name} ${ref.subject.abbreviation}`,
    };
  }
  if (subject) {
    return {
      rest: `${subject.name}, whole subject`,
      subjectText: `${subject.name} ${subject.abbreviation}`,
    };
  }
  return { rest: 'Not linked', subjectText: '' };
}

export default function Notes() {
  const { data } = useStore();
  const now = useNow();
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  const [query, setQuery] = useState('');

  const filterSubject = subjectId ? data.subjects.find((s) => s.id === subjectId) : undefined;
  const all = notesFor(data, subjectId ? { subjectId } : {});
  const q = fold(query.trim());
  const rows = all
    .map((n) => ({
      n,
      line: linkLine(data, n),
      age: ageLabel(n.createdAt, now),
    }))
    .filter(({ n, line, age }) =>
      q === ''
        ? true
        : fold(`${n.text} ${line.subjectText} ${line.lead ?? ''}${line.rest} ${age}`).includes(q),
    );

  return (
    <Page>
      <PageHeader title="Notes" actionLabel="New note" onAction={() => router.push('/note/edit')} />
      {filterSubject ? (
        <View style={styles.filter}>
          <Text variant="meta">{`Showing ${filterSubject.abbreviation} notes`}</Text>
          <TextButton label="Show all" onPress={() => router.replace('/notes')} />
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Search notes"
        placeholder="Word, subject or date"
        placeholderTextColor={theme.color.muted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        style={styles.search}
      />
      {all.length === 0 ? (
        <Text style={styles.empty}>No notes yet. Write one during class.</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>{`No notes match “${query.trim()}”.`}</Text>
      ) : (
        rows.map(({ n, line, age }) => (
          <NoteRow key={n.id} id={n.id} lead={line.lead} rest={line.rest} age={age} text={n.text} />
        ))
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  search: {
    minHeight: 44,
    borderWidth: 2,
    borderColor: theme.color.ink,
    paddingHorizontal: theme.space(3),
    fontFamily: theme.font.app,
    fontSize: 16,
    color: theme.color.ink,
    backgroundColor: theme.color.paper,
    marginVertical: theme.space(2),
  },
  empty: { paddingVertical: theme.space(4), color: theme.color.muted },
});
