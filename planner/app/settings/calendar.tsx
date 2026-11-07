import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  openCalendarFile,
  shareCalendarFile,
  type CalendarDelivery,
} from '../../src/data/calendarFile';
import { useStore } from '../../src/data/useStore';
import { calendarEvents, exportCalendar } from '../../src/domain/calendarExport';
import { mondayOf, todayISO } from '../../src/domain/dates';
import { Button } from '../../src/ui/Button';
import { FormScreen } from '../../src/ui/FormScreen';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const FILENAME = 'study-planner.ics';

type Outcome = 'downloaded' | 'shared' | 'unsupported' | 'error' | null;

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

  const empty = useMemo(() => {
    const today = todayISO();
    return calendarEvents(data, mondayOf(today), { classes, exams, today }).length === 0;
  }, [data, classes, exams]);

  const toggle = (set: (v: boolean) => void) => (v: boolean) => {
    set(v);
    setOutcome(null);
  };

  const run = async (
    deliver: (ics: string, filename: string) => CalendarDelivery | Promise<CalendarDelivery>,
  ) => {
    if (lock.current || empty) return;
    lock.current = true;
    setSaving(true);
    setOutcome(null);
    try {
      const now = new Date();
      const today = todayISO(now);
      const { ics } = exportCalendar(data, mondayOf(today), { classes, exams, today }, now);
      const result = await deliver(ics, FILENAME);
      if (result === 'downloaded' || result === 'shared' || result === 'unsupported') {
        setOutcome(result);
      }
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
        your calendar. It’s a copy: if your timetable changes, add it again.
      </Text>
      <View>
        <Check label="Classes" checked={classes} onChange={toggle(setClasses)} />
        <Check label="Exams" checked={exams} onChange={toggle(setExams)} />
      </View>
      {empty ? (
        <Text variant="meta">
          Nothing to add yet. Set up your semester and classes, or add an exam.
        </Text>
      ) : null}
      <Button
        label="Add to calendar"
        onPress={() => void run(openCalendarFile)}
        disabled={empty || saving}
      />
      <Button
        label="Save the file"
        kind="outline"
        onPress={() => void run(shareCalendarFile)}
        disabled={empty || saving}
      />
      <Text variant="meta">
        iPhone or iPad: tap Add to calendar, then Add All. When asked which calendar, choose New
        Calendar and name it “Study Planner”.
      </Text>
      <Text variant="meta">
        Google Calendar: on a computer, create a calendar called “Study Planner” (Settings → Add
        calendar), then Settings → Import and choose the study-planner.ics file.
      </Text>
      <Text variant="meta">
        To update later, delete the “Study Planner” calendar and add it again.
      </Text>
      {outcome === 'downloaded' ? (
        <Text>Downloaded study-planner.ics. Import it into your calendar as described below.</Text>
      ) : null}
      {outcome === 'shared' ? (
        <Text>Saved. Open the file from where you saved it to add it to your calendar.</Text>
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
