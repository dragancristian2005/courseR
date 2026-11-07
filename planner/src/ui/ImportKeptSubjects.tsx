import { View } from 'react-native';
import type { PlanSubject } from '../domain/importPlan';
import type { PlannerData } from '../domain/types';
import { ImportSubjectRow } from './ImportSubjectRow';
import { Rule } from './Rule';
import { Text } from './Text';

/** The subjects of the classes that stay, each with its attending switch. */
export function ImportKeptSubjects({
  subjects,
  data,
  attending,
  onToggle,
}: {
  subjects: PlanSubject[];
  data: PlannerData;
  /** Answers given so far, by abbreviation. */
  attending: Record<string, boolean>;
  onToggle: (abbreviation: string, attending: boolean) => void;
}) {
  const existingOf = (s: PlanSubject) =>
    s.existingId === null
      ? undefined
      : data.subjects.find((x) => x.id === s.existingId && !x.deleted);
  return (
    <View>
      <Text variant="title">Subjects</Text>
      <Rule weight="heavy" />
      {subjects.map((s) => (
        <ImportSubjectRow
          key={s.abbreviation}
          name={s.name}
          abbreviation={s.abbreviation}
          existing={existingOf(s) !== undefined}
          on={attending[s.abbreviation] ?? existingOf(s)?.attending ?? true}
          onToggle={(v) => onToggle(s.abbreviation, v)}
        />
      ))}
    </View>
  );
}
