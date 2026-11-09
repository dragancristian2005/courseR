import { StyleSheet, View } from 'react-native';
import { droppedByChange } from '../domain/edits';
import type { ImportDiff } from '../domain/importDiff';
import type { ClassPattern, PlannerData, Subject } from '../domain/types';
import { droppedWarning } from './ChangeForm';
import { Field, isDate, MSG_DATE } from './FormBits';
import { TYPE_LABEL } from './format';
import { whenWords } from './ImportBlockRow';
import { Text } from './Text';
import { theme } from './theme';

/** One-off changes and notes after `from` that the removed classes would take with them. */
function warningFor(diff: ImportDiff, data: PlannerData, from: string): string | null {
  if (!isDate(from)) return null;
  const dropped = { overrides: [] as never[], notes: [] as never[] };
  for (const p of diff.removed) {
    const d = droppedByChange(data, p.id, from);
    dropped.overrides.push(...(d.overrides as never[]));
    dropped.notes.push(...(d.notes as never[]));
  }
  return dropped.overrides.length + dropped.notes.length > 0 ? droppedWarning(dropped, from) : null;
}

/** Re-import: the date changes take effect, what is new and removed, and what won't carry over. */
export function ImportReimportPanel({
  from,
  onFromChange,
  diff,
  data,
  newSubjects,
}: {
  from: string;
  onFromChange: (from: string) => void;
  /** Null until every question is answered. */
  diff: ImportDiff | null;
  data: PlannerData;
  /** Subjects this import would create, for naming new classes. */
  newSubjects: Subject[];
}) {
  const line = (p: ClassPattern) =>
    [
      whenWords(p.weekday, p.start, p.end),
      [...newSubjects, ...data.subjects].find((s) => s.id === p.subjectId)?.name ?? '',
      TYPE_LABEL[p.type].toLowerCase(),
      p.room,
    ]
      .filter(Boolean)
      .join(', ');
  const warning = diff === null ? null : warningFor(diff, data, from);
  return (
    <View style={styles.block}>
      <Field
        label="Apply changes from"
        value={from}
        onChangeText={onFromChange}
        error={isDate(from) ? undefined : MSG_DATE}
      />
      {diff !== null ? (
        <>
          <Text style={styles.bold}>
            {`${diff.added.length} new, ${diff.removed.length} removed, ${diff.unchanged.length} unchanged`}
          </Text>
          {diff.reteached.length > 0 ? (
            <Text variant="meta">
              {`${diff.reteached.length} ${diff.reteached.length === 1 ? 'teacher' : 'teachers'} updated`}
            </Text>
          ) : null}
          {diff.added.length > 0 ? (
            <View>
              <Text variant="meta">New classes</Text>
              {diff.added.map((p, k) => (
                <Text key={`a${k}`}>{line(p)}</Text>
              ))}
            </View>
          ) : null}
          {diff.removed.length > 0 ? (
            <View>
              <Text variant="meta">Removed classes</Text>
              {diff.removed.map((p) => (
                <Text key={p.id}>{line(p)}</Text>
              ))}
            </View>
          ) : null}
          {warning ? <Text style={styles.warning}>{warning}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: theme.space(3) },
  bold: { fontFamily: theme.font.appBold },
  warning: { color: theme.color.now, fontFamily: theme.font.appBold },
});
