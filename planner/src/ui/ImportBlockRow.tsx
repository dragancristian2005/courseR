import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ImportBlock } from '../domain/importFormat';
import { TYPE_LABEL, WEEKDAYS_LONG } from './format';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme, typeFill } from './theme';

/** "Monday 13:00–14:30" */
export function whenWords(day: number, start: string, end: string): string {
  return `${WEEKDAYS_LONG[day - 1]} ${start}–${end}`;
}

/**
 * One block of the sheet, laid out like a Today row. A block that still needs an answer gets a red
 * outline; `children` holds its question.
 */
export function ImportBlockRow({
  testID,
  block,
  title,
  open,
  dimmed,
  children,
}: {
  testID: string;
  block: ImportBlock;
  title: string;
  open: boolean;
  dimmed: boolean;
  children?: ReactNode;
}) {
  const line = [
    block.type === null ? 'Type not known' : TYPE_LABEL[block.type],
    block.room,
    block.teacher,
  ]
    .filter((x): x is string => Boolean(x))
    .join(' · ');
  return (
    <View testID={testID} style={[styles.box, open && styles.open]}>
      <View style={[styles.row, dimmed && styles.dimmed]}>
        <View style={styles.times}>
          <Text variant="time">{block.start}</Text>
          <Text variant="meta" style={styles.end}>
            {block.end}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={`${title}, ${line}, ${block.start} to ${block.end}`}
          style={[
            styles.cell,
            { backgroundColor: block.type === null ? theme.color.rule : typeFill(block.type) },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text variant="meta" style={styles.line}>
            {line}
          </Text>
        </View>
      </View>
      {children ? <View style={styles.question}>{children}</View> : null}
      {open ? null : <Rule weight="hair" />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderColor: 'transparent' },
  open: { borderColor: theme.color.now, marginVertical: theme.space(1) },
  dimmed: { opacity: 0.45 },
  row: { flexDirection: 'row', minHeight: 64 },
  times: { width: 64, paddingTop: theme.space(2), paddingHorizontal: theme.space(2) },
  end: { fontSize: 12, fontVariant: ['tabular-nums'] },
  cell: { flex: 1, minHeight: 48, justifyContent: 'center', padding: theme.space(3), gap: 2 },
  title: { fontFamily: theme.font.appBold },
  line: { color: theme.color.ink },
  question: { padding: theme.space(3), gap: theme.space(3) },
});
