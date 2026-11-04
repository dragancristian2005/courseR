import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useStore } from '../../src/data/useStore';
import { linksBySubject } from '../../src/domain/selectors';
import { LinkRow } from '../../src/ui/LinkRow';
import { Page, PageHeader, SectionHeading } from '../../src/ui/Page';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

export default function Links() {
  const { data } = useStore();
  const { general, bySubject } = linksBySubject(data);
  return (
    <Page>
      <PageHeader title="Links" actionLabel="Add link" onAction={() => router.push('/link/edit')} />
      <SectionHeading>University</SectionHeading>
      {general.length === 0 ? (
        <Text style={styles.empty}>No general links yet.</Text>
      ) : (
        general.map((l) => <LinkRow key={l.id} link={l} />)
      )}
      <SectionHeading>By subject</SectionHeading>
      {bySubject.map(({ subject, links }) => (
        <View key={subject.id}>
          <View style={styles.grid}>
            <Text style={styles.abbr}>{subject.abbreviation}</Text>
            <View style={styles.links}>
              {links.length === 0 ? (
                <Text style={styles.empty}>No links yet. Add one from the class.</Text>
              ) : (
                links.map((l) => <LinkRow key={l.id} link={l} />)
              )}
            </View>
          </View>
          <Rule />
        </View>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: theme.space(3), color: theme.color.muted },
  grid: { flexDirection: 'row', alignItems: 'flex-start' },
  abbr: {
    width: 120,
    fontFamily: theme.font.appBold,
    paddingVertical: theme.space(3),
  },
  links: { flex: 1 },
});
