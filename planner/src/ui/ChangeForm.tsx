import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type {
  ClassPattern,
  ClassType,
  ISODate,
  Note,
  Repeat,
  SessionOverride,
} from '../domain/types';
import { Button } from './Button';
import { Chips, DateField, Field, isDate, MSG_DATE, timeErrors, TimeField } from './FormBits';
import { Text } from './Text';
import { theme } from './theme';
import { shortDate, TYPE_LABEL, WEEKDAYS_SHORT } from './format';

export const TYPE_OPTIONS: { value: ClassType; label: string }[] = [
  { value: 'course', label: TYPE_LABEL.course },
  { value: 'seminar', label: TYPE_LABEL.seminar },
  { value: 'lab', label: TYPE_LABEL.lab },
];
export const WEEKDAY_OPTIONS = WEEKDAYS_SHORT.map((label, i) => ({
  value: i + 1,
  label,
}));
export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'every', label: 'Every week' },
  { value: 'odd', label: 'Odd weeks' },
  { value: 'even', label: 'Even weeks' },
];

export interface ChangeValues {
  type: ClassType;
  weekday: ClassPattern['weekday'];
  start: string;
  end: string;
  room: string;
  teacher: string;
  repeat: Repeat;
  online: boolean;
}

export function droppedWarning(
  dropped: { overrides: SessionOverride[]; notes: Note[] },
  from: ISODate,
): string {
  const n = dropped.overrides.length;
  const m = dropped.notes.length;
  const parts = [
    n > 0 ? `${n} one-off ${n === 1 ? 'change' : 'changes'}` : null,
    m > 0 ? `${m} ${m === 1 ? 'note' : 'notes'}` : null,
  ].filter((x): x is string => x !== null);
  const date = shortDate(from);
  return `${parts.join(' and ')} on or after ${date} won’t carry over to the new schedule. Your notes stay in Notes.`;
}

export function ChangeForm({
  pattern,
  defaultFrom,
  dropFor,
  onSave,
  onCancel,
}: {
  pattern: ClassPattern;
  defaultFrom: ISODate;
  dropFor: (from: ISODate) => { overrides: SessionOverride[]; notes: Note[] };
  onSave: (from: ISODate, changes: ChangeValues) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [type, setType] = useState<ClassType>(pattern.type);
  const [weekday, setWeekday] = useState<number>(pattern.weekday);
  const [start, setStart] = useState(pattern.start);
  const [end, setEnd] = useState(pattern.end);
  const [room, setRoom] = useState(pattern.room);
  const [teacher, setTeacher] = useState(pattern.teacher);
  const [repeat, setRepeat] = useState<Repeat>(pattern.repeat);
  const [online, setOnline] = useState(pattern.online);
  const [warning, setWarning] = useState<string | null>(null);
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      setWarning(null);
      set(v);
    };
  const [failure, setFailure] = useState<string | null>(null);

  const errors = timeErrors(start, end);
  const fromError = isDate(from) ? undefined : MSG_DATE;
  const valid = !errors.start && !errors.end && !fromError;

  const save = () => {
    setFailure(null);
    try {
      onSave(from, {
        type,
        weekday: weekday as ClassPattern['weekday'],
        start,
        end,
        room: online ? pattern.room : room.trim(),
        teacher: teacher.trim(),
        repeat,
        online,
      });
    } catch (e) {
      setWarning(null);
      setFailure(e instanceof Error ? e.message : 'Could not save the change.');
    }
  };
  const submit = () => {
    const dropped = dropFor(from);
    if (dropped.overrides.length + dropped.notes.length > 0)
      setWarning(droppedWarning(dropped, from));
    else save();
  };

  return (
    <View style={styles.form}>
      <DateField
        label="Starting from"
        value={from}
        onChangeText={edit(setFrom)}
        error={fromError}
        placeholder="2026-11-09"
      />
      <Chips label="Type" options={TYPE_OPTIONS} value={type} onChange={edit(setType)} />
      <Chips
        label="Weekday"
        options={WEEKDAY_OPTIONS}
        value={weekday}
        onChange={edit(setWeekday)}
      />
      <TimeField
        label="Start"
        value={start}
        onChangeText={edit(setStart)}
        error={errors.start}
        placeholder="09:40"
      />
      <TimeField
        label="End"
        value={end}
        onChangeText={edit(setEnd)}
        error={errors.end}
        placeholder="11:10"
      />
      {online ? null : <Field label="Room" value={room} onChangeText={edit(setRoom)} />}
      <Field
        label="Teacher"
        value={teacher}
        onChangeText={edit(setTeacher)}
        autoCapitalize="words"
      />
      <Chips label="Repeats" options={REPEAT_OPTIONS} value={repeat} onChange={edit(setRepeat)} />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Online</Text>
        <Switch
          accessibilityLabel="Online"
          value={online}
          onValueChange={edit(setOnline)}
          trackColor={{ true: theme.color.ink, false: theme.color.rule }}
        />
      </View>
      {failure ? <Text style={styles.error}>{failure}</Text> : null}
      {warning ? (
        <View style={styles.warning}>
          <Text>{warning}</Text>
          <View style={styles.buttons}>
            <Button label="Save anyway" onPress={save} />
            <Button label="Go back" kind="outline" onPress={() => setWarning(null)} />
          </View>
        </View>
      ) : (
        <View style={styles.buttons}>
          <Button label="Save for every week" disabled={!valid} onPress={submit} />
          <Button label="Cancel" kind="outline" onPress={onCancel} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space(3), paddingVertical: theme.space(3) },
  buttons: { flexDirection: 'row', gap: theme.space(3), flexWrap: 'wrap' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  switchLabel: { fontFamily: theme.font.appBold },
  error: { color: theme.color.now, fontFamily: theme.font.appBold },
  warning: {
    gap: theme.space(3),
    borderLeftWidth: 4,
    borderLeftColor: theme.color.now,
    paddingLeft: theme.space(3),
  },
});
