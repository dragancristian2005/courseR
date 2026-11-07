import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { saveCalendarFile } from '../../src/data/calendarFile';
import { useStore } from '../../src/data/useStore';
import { calendarEvents, exportCalendar } from '../../src/domain/calendarExport';
import { mondayOf, todayISO } from '../../src/domain/dates';
import { Button } from '../../src/ui/Button';
import { FormScreen } from '../../src/ui/FormScreen';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

type Outcome = 'done' | 'unsupported' | 'error' | null;

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.check}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <Text>{label}</Text>
    </Pressable>
  );
}

export default function AddToCalendar() {
  const { data } = useStore();
  const [classes, setClasses] = useState(true);
  const [exams, setExams] = useState(true);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  const from = mondayOf(todayISO());
  const empty = useMemo(
    () => calendarEvents(data, from, { classes, exams }).length === 0,
    [data, from, classes, exams],
  );

  const add = async () => {
    if (lock.current || empty) return;
    lock.current = true;
    setSaving(true);
    setOutcome(null);
    try {
      const now = new Date();
      const { ics } = exportCalendar(data, mondayOf(todayISO(now)), { classes, exams }, now);
      const result = await saveCalendarFile(ics, 'study-planner.ics');
      if (result === 'unsupported') setOutcome('unsupported');
      else if (result !== 'cancelled') setOutcome('done');
    } catch {
      setOutcome('error');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <FormScreen title="Add to calendar">
      <Text>
        Adds your classes from this week to the end of the semester, and your upcoming exams, to
        your phone’s calendar. It’s a copy: if your timetable changes, add it again.
      </Text>
      <View>
        <Check label="Classes" checked={classes} onChange={setClasses} />
        <Check label="Exams" checked={exams} onChange={setExams} />
      </View>
      {empty ? (
        <Text variant="meta">
          Nothing to add yet. Set up your semester and classes, or add an exam.
        </Text>
      ) : null}
      <Button label="Add to calendar" onPress={() => void add()} disabled={empty || saving} />
      {outcome === 'done' ? (
        <>
          <Text>
            Done. In Apple Calendar, tap Add All. To avoid duplicates next time, delete the “Study
            Planner” calendar first.
          </Text>
          <Text variant="meta">
            Google Calendar: open calendar.google.com on a computer, Settings → Import, and choose
            the downloaded study-planner.ics.
          </Text>
        </>
      ) : null}
      {outcome === 'unsupported' ? (
        <Text>On this device, use the web app to export your calendar for now.</Text>
      ) : null}
      {outcome === 'error' ? (
        <Text style={styles.error}>Couldn’t create the calendar file. Try again.</Text>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  check: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
  },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  boxOn: { backgroundColor: theme.color.ink },
  tick: { color: theme.color.paper, fontFamily: theme.font.appBold, lineHeight: 18 },
  error: { color: theme.color.now, fontFamily: theme.font.appBold },
});
