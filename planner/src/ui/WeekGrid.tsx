import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { addDays, daysBetween, timeToMinutes, weekdayOf } from '../domain/dates';
import type { ClassType, ISODate, Session, Subject } from '../domain/types';
import { STANDARD_SLOTS, TYPE_LABEL, WEEKDAYS_SHORT } from './format';
import { Text } from './Text';
import { theme, typeFill } from './theme';
import {
  ROW_HEIGHT,
  SLOT_LENGTH,
  SLOT_MINUTES,
  slotRowOf,
  snapDrop,
  type DropTarget,
} from './weekDrag';

const GRID_START = SLOT_MINUTES[0];
const GRID_END = SLOT_MINUTES[SLOT_MINUTES.length - 1] + SLOT_LENGTH;
const SPINE_WIDTH = 42;
/** Hold this long on a class to pick it up; a shorter touch is a tap or a scroll. */
const LONG_PRESS_MS = 300;

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
  /**
   * Called when a class is long-pressed, dragged and dropped on another day or slot. Without it
   * classes cannot be dragged. Cancelled classes never can.
   */
  onDropSession?: (s: Session, target: DropTarget) => void;
  /** True while a class is being dragged, so the screen can stop scrolling. */
  onDragChange?: (dragging: boolean) => void;
  /** A drop waiting for an answer: its class is dimmed and its landing place outlined. */
  pendingDrop?: { sessionId: string; target: DropTarget };
}

/** Number of columns shown: Monday to Friday, extended to the last weekend day with a class. */
export function lastShownDay(sessions: Session[], monday: ISODate): number {
  let last = 5;
  for (const s of sessions) last = Math.max(last, weekdayOf(s.date));
  return last;
}

function rowRange(s: Pick<Session, 'start' | 'end'>): [number, number] {
  const end = timeToMinutes(s.end);
  const first = slotRowOf(s.start);
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

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  return a === b || (!!a && !!b && a.date === b.date && a.start === b.start && a.end === b.end);
}

function BlockBody({
  session: s,
  subject,
  full,
  cancelled,
}: {
  session: Session;
  subject: Subject | undefined;
  full: boolean;
  cancelled: boolean;
}) {
  const name = subject?.name ?? 'Class';
  const strike = cancelled ? styles.cancelledText : undefined;
  return (
    <>
      {full ? (
        <>
          <Text style={[styles.cellName, strike]}>{name}</Text>
          <Text style={[styles.cellMeta, strike]}>{TYPE_LABEL[s.type]}</Text>
          <Text style={[styles.cellMeta, strike]}>{s.online ? 'Online' : s.room}</Text>
        </>
      ) : (
        <>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.cellName, strike]}>
            {subject?.abbreviation ?? name}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.cellMeta, strike]}>
            {s.online ? 'Online' : s.room}
          </Text>
        </>
      )}
      {s.moved && !cancelled ? (
        <Text numberOfLines={1} style={styles.movedLabel}>
          Moved
        </Text>
      ) : null}
    </>
  );
}

/** Where the picked-up class is drawn while it follows the finger, in body coordinates. */
interface Ghost {
  session: Session;
  left: number;
  top: number;
  width: number;
  height: number;
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
  onDropSession,
  onDragChange,
  pendingDrop,
}: WeekGridProps) {
  const days = Array.from({ length: lastShownDay(sessions, monday) }, (_, i) => addDays(monday, i));
  const nowVisible = nowMinutes >= GRID_START && nowMinutes < GRID_END;
  const nowTop = ((nowMinutes - GRID_START) / SLOT_LENGTH) * ROW_HEIGHT;
  const full = density === 'full';

  // Dragging: a long press picks a class up (armed); the body then claims the next move, so the
  // class follows the finger and the week cannot scroll; release snaps it to a day and slot.
  const [bodyWidth, setBodyWidth] = useState(0);
  const columnWidth = bodyWidth > 0 ? (bodyWidth - SPINE_WIDTH) / days.length : 0;
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [hover, setHover] = useState<DropTarget | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const armed = useRef<Placed | null>(null);
  const active = useRef(false);
  const bodyRef = useRef<ComponentRef<typeof View>>(null);
  // The responder is created once; it reads the latest props from here.
  const live = useRef({ monday, dayCount: days.length, columnWidth, onDropSession, onDragChange });
  live.current = { monday, dayCount: days.length, columnWidth, onDropSession, onDragChange };

  const responder = useMemo(() => {
    const snap = (s: Session, dx: number, dy: number) => {
      const { monday: m, dayCount, columnWidth: w } = live.current;
      return snapDrop({ session: s, monday: m, dayCount, columnWidth: w, dx, dy });
    };
    const finish = (gesture?: { dx: number; dy: number }) => {
      const picked = armed.current;
      const wasActive = active.current;
      armed.current = null;
      active.current = false;
      setGhost(null);
      setHover(null);
      pan.setValue({ x: 0, y: 0 });
      if (wasActive) live.current.onDragChange?.(false);
      const target = picked && gesture ? snap(picked.session, gesture.dx, gesture.dy) : null;
      if (picked && target) live.current.onDropSession?.(picked.session, target);
    };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: () => armed.current !== null,
      onPanResponderGrant: () => {
        const p = armed.current;
        if (!p) return;
        active.current = true;
        const { monday: m, columnWidth: w } = live.current;
        const col = daysBetween(m, p.session.date);
        setGhost({
          session: p.session,
          left: SPINE_WIDTH + w * (col + p.lane / p.lanes),
          top: p.first * ROW_HEIGHT,
          width: w / p.lanes,
          height: (p.last - p.first + 1) * ROW_HEIGHT,
        });
        live.current.onDragChange?.(true);
      },
      onPanResponderMove: (_e, g) => {
        const p = armed.current;
        if (!p) return;
        pan.setValue({ x: g.dx, y: g.dy });
        const next = snap(p.session, g.dx, g.dy);
        setHover((prev) => (sameTarget(prev, next) ? prev : next));
      },
      onPanResponderRelease: (_e, g) => finish(g),
      onPanResponderTerminate: () => finish(),
      onPanResponderTerminationRequest: () => !active.current,
    });
  }, [pan]);

  // iOS Safari: once a class is picked up, stop the page from scrolling under the finger (React
  // listens to touchmove passively, so this needs its own listener), and keep the long press from
  // selecting text or opening the callout.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = bodyRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.style.setProperty('-webkit-touch-callout', 'none');
    node.style.setProperty('-webkit-user-select', 'none');
    node.style.setProperty('user-select', 'none');
    const hold = (e: Event) => {
      if (armed.current) e.preventDefault();
    };
    node.addEventListener('touchmove', hold, { passive: false });
    return () => node.removeEventListener('touchmove', hold);
  }, []);

  const dragged = ghost?.session;
  const outline: DropTarget | null = pendingDrop
    ? pendingDrop.target
    : dragged
      ? (hover ?? { date: dragged.date, start: dragged.start, end: dragged.end })
      : null;
  const outlineRows = outline ? rowRange(outline) : null;
  const dimmedId = dragged?.id ?? pendingDrop?.sessionId;

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
      <View
        ref={bodyRef}
        testID="week-grid-body"
        style={styles.body}
        onLayout={(e) => setBodyWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
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
              {placed.map((p) => {
                const { session: s, first, last, lane, lanes } = p;
                const subject = subjects.find((x) => x.id === s.subjectId);
                const name = subject?.name ?? 'Class';
                const room = s.online ? 'online' : s.room;
                const selected = s.id === selectedSessionId;
                const cancelled = cancelledIds?.has(s.id) ?? false;
                const draggable = !!onDropSession && !cancelled;
                return (
                  <Pressable
                    key={s.id}
                    testID={`cell-${s.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${s.type}, ${WEEKDAYS_SHORT[col]} ${s.start} to ${s.end}, room ${room}${s.moved ? ', moved' : ''}${cancelled ? ', cancelled' : ''}`}
                    accessibilityState={{ selected }}
                    onPress={() => onPressSession(s)}
                    delayLongPress={LONG_PRESS_MS}
                    onLongPress={
                      draggable
                        ? () => {
                            armed.current = p;
                          }
                        : undefined
                    }
                    onPressOut={
                      draggable
                        ? () => {
                            // Let go without moving: drop the pick-up. Deferred, because the body
                            // claiming the touch also ends this press.
                            setTimeout(() => {
                              if (!active.current && armed.current?.session.id === s.id)
                                armed.current = null;
                            }, 0);
                          }
                        : undefined
                    }
                    style={{
                      position: 'absolute',
                      top: first * ROW_HEIGHT,
                      height: (last - first + 1) * ROW_HEIGHT,
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`,
                      backgroundColor: cancelled ? theme.color.paper : typeFill(s.type),
                      borderWidth: selected ? 2 : 1,
                      borderStyle: cancelled && !selected ? 'dashed' : 'solid',
                      borderColor: selected
                        ? theme.color.ink
                        : cancelled
                          ? theme.color.muted
                          : theme.color.paper,
                      padding: 4,
                      overflow: 'hidden',
                      ...(s.id === dimmedId ? { opacity: 0.35 } : null),
                    }}
                  >
                    <BlockBody session={s} subject={subject} full={full} cancelled={cancelled} />
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
              {outline && outlineRows && outline.date === d ? (
                <View
                  testID="drop-outline"
                  pointerEvents="none"
                  style={[
                    styles.outline,
                    {
                      top: outlineRows[0] * ROW_HEIGHT,
                      height: (outlineRows[1] - outlineRows[0] + 1) * ROW_HEIGHT,
                    },
                  ]}
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
        {ghost ? (
          <Animated.View
            testID="drag-ghost"
            pointerEvents="none"
            style={[
              styles.ghost,
              {
                left: ghost.left,
                top: ghost.top,
                width: ghost.width,
                height: ghost.height,
                backgroundColor: typeFill(ghost.session.type),
                transform: pan.getTranslateTransform(),
              },
            ]}
          >
            <BlockBody
              session={ghost.session}
              subject={subjects.find((x) => x.id === ghost.session.subjectId)}
              full={full}
              cancelled={false}
            />
          </Animated.View>
        ) : null}
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
  outline: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.color.ink,
  },
  ghost: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.color.ink,
    padding: 4,
    overflow: 'hidden',
  },
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
