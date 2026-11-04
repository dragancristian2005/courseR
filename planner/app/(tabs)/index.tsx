import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useStore } from "../../src/data/useStore";
import { timeToMinutes, todayISO, weekdayOf } from "../../src/domain/dates";
import {
  dueLabel,
  homeworkGroups,
  nextExam,
  todayAgenda,
} from "../../src/domain/selectors";
import type {
  ClassType,
  Homework,
  ISODate,
  PlannerData,
  Session,
} from "../../src/domain/types";
import { Rule } from "../../src/ui/Rule";
import { SetupPrompt } from "../../src/ui/SetupPrompt";
import { SlotRow } from "../../src/ui/SlotRow";
import { Text } from "../../src/ui/Text";
import { theme } from "../../src/ui/theme";
import { useLayout } from "../../src/ui/useLayout";
import { useNow } from "../../src/ui/useNow";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const STANDARD_STARTS = [
  "08:00",
  "09:40",
  "11:20",
  "13:00",
  "14:40",
  "16:20",
  "18:00",
  "19:40",
];
const TYPE_LABEL: Record<ClassType, string> = {
  course: "Course",
  seminar: "Seminar",
  lab: "Lab",
};

const parts = (d: ISODate) => {
  const [, m, day] = d.split("-").map(Number);
  return { day, month: MONTHS[m - 1], weekday: WEEKDAYS[weekdayOf(d) - 1] };
};
const hhmm = (now: Date) =>
  `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
const isUrgent = (label: string) =>
  label === "Overdue" || label === "Today" || label === "Tomorrow";

function subtitleOf(s: Session): string {
  const type = TYPE_LABEL[s.type];
  const base = s.online ? `${type}, online` : `${type} in ${s.room}`;
  return s.teacher ? `${base} with ${s.teacher}` : base;
}

function Header({ today, weekLine }: { today: ISODate; weekLine: string }) {
  const p = parts(today);
  return (
    <View>
      <Text style={styles.date}>{`${p.weekday} ${p.day} ${p.month}`}</Text>
      <Text variant="meta">{weekLine}</Text>
    </View>
  );
}

function weekLineOf(week: ReturnType<typeof todayAgenda>["week"]): string {
  if (!week) return "Outside the semester";
  if (week.isBreak) return "Break";
  return `Week ${week.number}, ${week.parity} week`;
}

function Homeworks({
  items,
  data,
  today,
}: {
  items: Homework[];
  data: PlannerData;
  today: ISODate;
}) {
  const { repo } = useStore();
  if (items.length === 0) return null;
  return (
    <View>
      {items.map((hw) => {
        const subject = hw.subjectId
          ? data.subjects.find((s) => s.id === hw.subjectId)
          : undefined;
        const label = dueLabel(hw.due, today);
        return (
          <View key={hw.id}>
            <View style={styles.hwRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hw.done }}
                accessibilityLabel={hw.title}
                onPress={() =>
                  void repo.upsert("homework", {
                    ...hw,
                    done: true,
                    updatedAt: Date.now(),
                  })
                }
                style={styles.checkHit}
              >
                <View style={styles.checkbox} />
              </Pressable>
              <Text style={styles.hwTitle}>
                {subject ? `${hw.title} for ${subject.abbreviation}` : hw.title}
              </Text>
              <Text
                variant="meta"
                style={isUrgent(label) ? styles.urgent : undefined}
              >
                {label}
              </Text>
            </View>
            <Rule weight="hair" />
          </View>
        );
      })}
    </View>
  );
}

export default function Today() {
  const layout = useLayout();
  const now = useNow();
  const { data } = useStore();
  const today = todayISO(now);
  const nowTime = hhmm(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const agenda = todayAgenda(data, today, nowMinutes);
  const exam = nextExam(data, today);
  const hw = homeworkGroups(data, today).thisWeek;

  const settings =
    layout === "phone" ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push("/settings")}
        style={styles.settings}
      >
        <Text style={{ fontFamily: theme.font.appBold }}>Settings</Text>
      </Pressable>
    ) : null;

  let body: React.ReactNode;
  const prompt = <SetupPrompt data={data} />;
  if (!data.semester || data.patterns.length === 0) {
    body = prompt;
  } else {
    const { sessions, currentSessionId, freeAfter, week } = agenda;
    const lastEnd = sessions.reduce(
      (m, s) => Math.max(m, timeToMinutes(s.end)),
      0,
    );
    const thin = STANDARD_STARTS.filter((t) => timeToMinutes(t) >= lastEnd);
    body = (
      <View>
        {week?.isBreak ? (
          <Text style={styles.plain}>No classes this week, it’s a break.</Text>
        ) : sessions.length === 0 ? (
          week ? (
            <Text style={styles.plain}>No classes today.</Text>
          ) : null
        ) : (
          <View>
            {sessions.map((s) => {
              const subject = data.subjects.find((x) => x.id === s.subjectId);
              return (
                <SlotRow
                  key={s.id}
                  start={s.start}
                  end={s.end}
                  title={subject?.name ?? "Class"}
                  subtitle={subtitleOf(s)}
                  room={s.online ? undefined : s.room}
                  type={s.type}
                  now={s.id === currentSessionId}
                  nowTime={nowTime}
                  onPress={() =>
                    router.push({
                      pathname: "/class/[sessionId]",
                      params: { sessionId: s.id },
                    })
                  }
                />
              );
            })}
            {thin.map((t, i) => (
              <View key={t}>
                <View style={styles.thin}>
                  <Text variant="time" style={styles.thinTime}>
                    {t}
                  </Text>
                  {i === thin.length - 1 && freeAfter ? (
                    <Text variant="meta">{`Free after ${freeAfter}`}</Text>
                  ) : null}
                </View>
                <Rule weight={i === thin.length - 1 ? "heavy" : "hair"} />
              </View>
            ))}
            {thin.length === 0 ? <Rule weight="heavy" /> : null}
          </View>
        )}
        <Homeworks items={hw} data={data} today={today} />
        {exam ? (
          <>
            <Rule weight="hair" />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/exams")}
              style={styles.exam}
            >
              <Text style={styles.examTitle}>
                {`Next exam: ${exam.exam.title}, ${parts(exam.exam.date).weekday.slice(0, 3)} ${parts(exam.exam.date).day} ${parts(exam.exam.date).month.slice(0, 3)}`}
              </Text>
              <Text style={styles.examCount}>
                {exam.daysAway === 0
                  ? "Today"
                  : exam.daysAway === 1
                    ? "1 day"
                    : `${exam.daysAway} days`}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <Header today={today} weekLine={weekLineOf(agenda.week)} />
          {settings}
        </View>
        <Rule weight="heavy" />
        {body}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.paper },
  content: { padding: theme.space(4), alignItems: "center" },
  inner: { width: "100%", maxWidth: 720 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: theme.space(2),
  },
  date: {
    fontFamily: theme.font.appBold,
    fontSize: 30,
    color: theme.color.ink,
  },
  settings: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  plain: { paddingVertical: theme.space(4) },
  thin: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(2),
  },
  thinTime: { fontSize: 12, color: theme.color.muted, width: 48 },
  hwRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: theme.space(2),
  },
  checkHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  hwTitle: { flex: 1 },
  urgent: { color: theme.color.now, fontFamily: theme.font.appBold },
  exam: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space(3),
  },
  examTitle: { flex: 1 },
  examCount: {
    fontFamily: theme.font.appBold,
    fontSize: 22,
    color: theme.color.ink,
  },
});
