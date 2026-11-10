import { router } from 'expo-router';

/**
 * Leave an import flow after a save so that Back doesn't return to the paste box: pop the whole
 * stack, then replace with the destination. dismissAll can be a no-op on web, and replace alone
 * is then all that happens.
 */
export function leaveImport(dest: '/' | '/exams'): void {
  leaveTo(dest);
}

/**
 * Go to a tab from a pushed screen, clearing the screens above the tabs first. replace() alone
 * would only swap the top screen and leave the tabs on whichever tab was open before.
 */
export function leaveTo(dest: '/' | '/exams' | '/homework'): void {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // Nothing to dismiss; replacing below is enough.
  }
  router.replace(dest);
}
