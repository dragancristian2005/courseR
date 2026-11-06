import { router } from 'expo-router';
import type { PlannerData } from '../domain/types';
import { EmptyState } from './EmptyState';

/** The first-run prompt for a missing semester or missing classes; null once both exist. */
export function SetupPrompt({ data }: { data: PlannerData }) {
  if (!data.semester) {
    return (
      <EmptyState
        title="Set up your semester"
        body="Add your semester dates, then your classes, to see your day here."
        actionLabel="Set up semester"
        onAction={() => router.push('/settings/semester')}
        secondaryLabel="Import from a photo"
        onSecondary={() => router.push('/import')}
      />
    );
  }
  if (data.patterns.length === 0) {
    return (
      <EmptyState
        title="Add your classes"
        body="Add each class once and it repeats every week."
        actionLabel="Add a class"
        onAction={() => router.push('/class/edit')}
        secondaryLabel="Import from a photo"
        onSecondary={() => router.push('/import')}
      />
    );
  }
  return null;
}
