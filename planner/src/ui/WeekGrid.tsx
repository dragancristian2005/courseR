import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, timeToMinutes, weekdayOf } from '../domain/dates';
import type { ClassType, ISODate, Session, Subject } from '../domain/types';
import { STANDARD_SLOTS, TYPE_LABEL, WEEKDAYS_SHORT } from './format';
import { Text } from './Text';
import { theme, typeFill } from './theme';

const SLOT_MINUTES = STANDARD_SLOTS.map(timeToMinutes);
const SLOT_LENGTH = 100;
const GRID_START = SLOT_MINUTES[0];
const GRID_END = SLOT_MINUTES[SLOT_MINUTES.length - 1] + SLOT_LENGTH;
const ROW_HEIGHT = 64;
const SPINE_WIDTH = 42;

export interface WeekGridProps {
  sessions: Session[];
  subjects: Subject[];
  monday: ISODate;
  today: ISODate;
  nowMinutes: number;
  onPressSession: (s: Session) => void;
  density: 'compact' | 'full';
  selectedSessionId?: string;
  /** Ids of cancelled occurrences in `sessions`, drawn muted and struck through. */
  cancelledIds?: ReadonlySet<string>;
}

/** Number of columns shown: Monday to Friday, extended to the last weekend day with a class. */
export function lastShownDay(sessions: Session[], monday: ISODate): number {
  let last = 5;
  for (const s of sessions) last = Math.max(last, weekdayOf(s.date));
  return last;
}

function rowRange(s: Session): [number, number] {
  const start = timeToMinutes(s.start);
  const end = timeToMinutes(s.end);
  let first = 0;
  SLOT_MINUTES.forEach((m, i) => {
    if (m <= start) first = i;
  });
  let last = first;
  SLOT_MINUTES.forEach((m, i) => {
    if (i > first && m < end) last = i;
  });
  return [first, last];
}

interface Placed {
  session: Session;
  first: number;
  last: number;
  lane: number;
  lanes: number;
}

/** Lay out one day: overlapping sessions get side-by-side lanes. */
function place(day: Session[]): Placed[] {
  const items = day
    .map((session) => {
      const [first, last] = rowRange(session);
      return { session, first, last, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.first - b.first || a.last - b.last);
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const close = () => {
    const lanes = cluster.reduce((m, p) => Math.max(m, p.lane + 1), 1);
    cluster.forEach((p) => (p.lanes = lanes));
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length > 0 && item.first > clusterEnd) close();
    const taken = new Set(cluster.filter((p) => p.last >= item.first).map((p) => p.lane));
    while (taken.has(item.lane)) item.lane++;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.last);
  }
  close();
  return items;
}

export function WeekGrid({
  sessions,
  subjects,
  monday,
  today,
  nowMinutes,
  onPressSession,
  density,
  selectedSessionId,
  cancelledIds,
}: WeekGridProps) {
  const days = Array.from({ length: lastShownDay(sessions, monday) }, (_, i) => addDays(monday, i));
  const nowVisible = nowMinutes >= GRID_START && nowMinutes < GRID_END;
  const nowTop = ((nowMinutes - GRID_START) / SLOT_LENGTH) * ROW_HEIGHT;
  const full = density === 'full';

  return (
    <View>
      <View style={styles.headRow}>
        <View style={{ width: SPINE_WIDTH }} />
        {days.map((d, i) => {
          const isToday = d === today;
          return (
            <View
              key={d}
              testID={isToday ? 'today-header' : undefined}
              style={[styles.dayHead, i > 0 && styles.colLine, isToday && styles.dayHeadToday]}
            >
              <Text
                style={[
                  styles.dayHeadText,
                  { color: isToday ? theme.color.paper : theme.color.ink },
                ]}
              >{`${WEEKDAYS_SHORT[i]} ${Number(d.slice(8))}`}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.body}>
        <View
          style={{
            width: SPINE_WIDTH,
            height: ROW_HEIGHT * STANDARD_SLOTS.length,
          }}
        >
          {STANDARD_SLOTS.map((t, i) => (
            <Text key={t} variant="time" style={[styles.spineTime, { top: i * ROW_HEIGHT }]}>
              {t}
            </Text>
          ))}
        </View>
        {days.map((d, col) => {
          const placed = place(sessions.filter((s) => s.date === d));
          return (
            <View key={d} style={[styles.column, col > 0 && styles.colLine]}>
              {placed.map(({ session: s, first, last, lane, lanes }) => {
                const subject = subjects.find((x) => x.id === s.subjectId);
                const name = subject?.name ?? 'Class';
                const room = s.online ? 'online' : s.room;
                const selected = s.id === selectedSessionId;
                const cancelled = cancelledIds?.has(s.id) ?? false;
                const strike = cancelled ? styles.cancelledText : undefined;
                return (
                  <Pressable
                    key={s.id}
                    testID={`cell-${s.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${s.type}, ${WEEKDAYS_SHORT[col]} ${s.start} to ${s.end}, room ${room}${s.moved ? ', moved' : ''}${cancelled ? ', cancelled' : ''}`}
                    accessibilityState={{ selected }}
                    onPress={() => onPressSession(s)}
                    style={{
                      position: 'absolute',
                      top: first * ROW_HEIGHT,
                      height: (last - first + 1) * ROW_HEIGHT,
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`,
                      backgroundColor: cancelled ? theme.color.paper : typeFill(s.type),
                      opacity: cancelled ? 0.7 : 1,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? theme.color.ink : theme.color.paper,
                      padding: 4,
                      overflow: 'hidden',
                    }}
                  >
                    {full ? (
                      <>
                        <Text style={[styles.cellName, strike]}>{name}</Text>
                        <Text style={[styles.cellMeta, strike]}>{TYPE_LABEL[s.type]}</Text>
                        <Text style={[styles.cellMeta, strike]}>
                          {s.online ? 'Online' : s.room}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[styles.cellName, strike]}
                        >
                          {subject?.abbreviation ?? name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[styles.cellMeta, strike]}
                        >
                          {s.online ? 'Online' : s.room}
                        </Text>
                      </>
                    )}
                    {s.moved && !cancelled ? (
                      <Text numberOfLines={1} style={styles.movedLabel}>
                        Moved
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {d === today && nowVisible ? (
                <View
                  testID="week-now-line"
                  pointerEvents="none"
                  style={[styles.nowLine, { top: nowTop }]}
                />
              ) : null}
            </View>
          );
        })}
        <View pointerEvents="none" style={styles.rules}>
          {STANDARD_SLOTS.map((t, i) => (
            <View key={t} style={[styles.rule, { top: i * ROW_HEIGHT }]} />
          ))}
          <View style={[styles.rule, { top: STANDARD_SLOTS.length * ROW_HEIGHT - 1 }]} />
        </View>
      </View>
      <View style={styles.legend}>
        {(['course', 'seminar', 'lab'] as ClassType[]).map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: typeFill(t) }]} />
            <Text variant="meta">{TYPE_LABEL[t]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.color.rule,
  },
  dayHead: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeadToday: { backgroundColor: theme.color.ink },
  dayHeadText: { fontFamily: theme.font.appBold, fontSize: 13 },
  colLine: { borderLeftWidth: 1, borderLeftColor: theme.color.rule },
  body: { flexDirection: 'row', height: ROW_HEIGHT * STANDARD_SLOTS.length },
  spineTime: {
    position: 'absolute',
    left: 0,
    width: SPINE_WIDTH,
    paddingTop: 3,
    paddingLeft: 2,
    fontFamily: theme.font.appBold,
    fontSize: 11,
  },
  column: { flex: 1, height: ROW_HEIGHT * STANDARD_SLOTS.length },
  rules: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.color.rule,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.color.now,
  },
  cellName: {
    fontFamily: theme.font.appBold,
    fontSize: 12,
    color: theme.color.ink,
  },
  cellMeta: {
    fontSize: 11,
    color: theme.color.ink,
    fontVariant: ['tabular-nums'],
  },
  cancelledText: { textDecorationLine: 'line-through', color: theme.color.muted },
  movedLabel: { fontSize: 11, color: theme.color.muted, fontFamily: theme.font.appBold },
  legend: {
    flexDirection: 'row',
    gap: theme.space(4),
    paddingTop: theme.space(3),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(1),
  },
  swatch: { width: 14, height: 14 },
});
