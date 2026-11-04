import { Pressable, StyleSheet, View } from 'react-native';
import type { ClassType, HHMM } from '../domain/types';
import { Rule } from './Rule';
import { Text } from './Text';
import { theme, typeFill } from './theme';

export interface SlotRowProps {
  start: HHMM;
  end: HHMM;
  title: string;
  subtitle?: string;
  room?: string;
  type: ClassType;
  onPress?: () => void;
  now?: boolean;
  nowTime?: HHMM;
}

const minutes = (t: HHMM): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

function nowFraction(start: HHMM, end: HHMM, nowTime?: HHMM): number {
  if (!nowTime) return 0.5;
  const span = minutes(end) - minutes(start);
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (minutes(nowTime) - minutes(start)) / span));
}

export function SlotRow({
  start,
  end,
  title,
  subtitle,
  room,
  type,
  onPress,
  now,
  nowTime,
}: SlotRowProps) {
  const label = `${title}, ${type}, ${start} to ${end}${room ? `, room ${room}` : ''}`;
  const top = `${nowFraction(start, end, nowTime) * 100}%` as const;
  const cellStyle = [styles.cell, { backgroundColor: typeFill(type) }];
  const content = (
    <>
      <Text variant="body" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="meta" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.times}>
          <Text variant="time">{start}</Text>
          <Text variant="meta" style={styles.end}>
            {end}
          </Text>
        </View>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            style={cellStyle}
          >
            {content}
          </Pressable>
        ) : (
          <View accessible accessibilityLabel={label} style={cellStyle}>
            {content}
          </View>
        )}
        {now ? (
          <>
            <View pointerEvents="none" testID="slot-now-line" style={[styles.nowLine, { top }]} />
            <View pointerEvents="none" style={[styles.nowTag, { top }]}>
              <Text variant="time" style={styles.nowTime}>
                {nowTime ?? ''}
              </Text>
            </View>
          </>
        ) : null}
      </View>
      <Rule weight="hair" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 64 },
  times: { width: 64, paddingTop: theme.space(2), paddingHorizontal: theme.space(2) },
  end: { fontSize: 12, fontVariant: ['tabular-nums'] },
  cell: { flex: 1, minHeight: 48, justifyContent: 'center', padding: theme.space(3), gap: 2 },
  title: { fontFamily: theme.font.appBold },
  subtitle: { color: theme.color.ink },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: theme.color.now },
  nowTag: {
    position: 'absolute',
    left: 0,
    marginTop: -10,
    paddingHorizontal: theme.space(1),
    backgroundColor: theme.color.now,
  },
  nowTime: { color: theme.color.paper, fontSize: 12 },
});
