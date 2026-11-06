import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ImportBlock, UnsureField } from '../domain/importFormat';
import { TYPE_LABEL } from './format';
import { Chips, Field, isTime, MSG_TIME } from './FormBits';
import { whenWords } from './ImportBlockRow';
import { Text } from './Text';
import { TextButton } from './TextButton';
import { theme } from './theme';
import type { ClassType, Repeat } from '../domain/types';

const TYPE_OPTIONS: { value: ClassType; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'lab', label: 'Lab' },
];

const WEEKS_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'every', label: 'Every week' },
  { value: 'odd', label: 'Odd weeks' },
  { value: 'even', label: 'Even weeks' },
];

const FIELD_WORDS: Record<UnsureField, string> = {
  subject: 'subject',
  type: 'type',
  room: 'room',
  teacher: 'teacher',
  start: 'start time',
  end: 'end time',
  weeks: 'weeks',
};

function inWords(fields: string[]): string {
  const words = fields.map((f) => FIELD_WORDS[f as UnsureField] ?? f);
  return words.length <= 1
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export interface ChoiceOption {
  index: number;
  title: string;
  block: ImportBlock;
}

export function ChooseOneQuestion({
  options,
  chosen,
  onChoose,
}: {
  options: ChoiceOption[];
  chosen: number | undefined;
  onChoose: (index: number) => void;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.ask}>These classes are alternatives. Which do you attend?</Text>
      <View accessibilityRole="radiogroup">
        {options.map(({ index, title, block }) => {
          const selected = chosen === index;
          const type =
            block.type === null ? 'type not known' : TYPE_LABEL[block.type].toLowerCase();
          const label = [title, type, block.room, whenWords(block.day, block.start, block.end)]
            .filter(Boolean)
            .join(', ');
          return (
            <Pressable
              key={index}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChoose(index)}
              style={styles.option}
            >
              <View style={[styles.dot, selected && styles.dotOn]} />
              <Text style={styles.optionText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TypeQuestion({
  value,
  onChange,
}: {
  value: ClassType | null;
  onChange: (t: ClassType) => void;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.ask}>The sheet doesn’t say if this is a course, seminar or lab.</Text>
      <Chips label="Type" options={TYPE_OPTIONS} value={value} onChange={onChange} />
    </View>
  );
}

export function UnsureQuestion({
  fields,
  block,
  showType,
  type,
  onType,
  onEdit,
}: {
  fields: string[];
  /** The block as it stands, with edits applied. */
  block: ImportBlock;
  /** Offer the type chips here (false when the type question already does). */
  showType: boolean;
  type: ClassType | null;
  onType: (t: ClassType) => void;
  onEdit: (patch: Partial<ImportBlock>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end);
  return (
    <View style={styles.box}>
      <Text style={styles.ask}>{`Check this: ${inWords(fields)} may be misread.`}</Text>
      {editing ? (
        <View style={styles.form}>
          <Field
            label="Subject"
            value={block.subject}
            onChangeText={(v) => onEdit({ subject: v })}
          />
          {showType ? (
            <Chips label="Type" options={TYPE_OPTIONS} value={type} onChange={onType} />
          ) : null}
          <Field
            label="Start"
            value={start}
            onChangeText={(v) => {
              setStart(v);
              if (isTime(v)) onEdit({ start: v });
            }}
            error={isTime(start) ? undefined : MSG_TIME}
          />
          <Field
            label="End"
            value={end}
            onChangeText={(v) => {
              setEnd(v);
              if (isTime(v)) onEdit({ end: v });
            }}
            error={isTime(end) ? undefined : MSG_TIME}
          />
          <Field label="Room" value={block.room ?? ''} onChangeText={(v) => onEdit({ room: v })} />
          <Field
            label="Teacher"
            value={block.teacher ?? ''}
            onChangeText={(v) => onEdit({ teacher: v })}
            autoCapitalize="words"
          />
          <Chips
            label="Weeks"
            options={WEEKS_OPTIONS}
            value={block.weeks}
            onChange={(w) => onEdit({ weeks: w })}
          />
          <TextButton label="Done" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <TextButton label="Edit" onPress={() => setEditing(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: theme.space(2) },
  ask: { fontFamily: theme.font.appBold, color: theme.color.ink },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(1),
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.paper,
  },
  dotOn: { backgroundColor: theme.color.ink },
  optionText: { flex: 1 },
  form: { gap: theme.space(3) },
});
