import { Button } from './Button';
import { FormScreen } from './FormScreen';
import { Rule } from './Rule';
import { Text } from './Text';

/** Shown by an import review screen when no matching import is waiting. */
export function NothingToReview({ title, onGo }: { title: string; onGo: () => void }) {
  return (
    <FormScreen title={title}>
      <Rule weight="heavy" />
      <Text>Nothing to review. Start an import from Settings.</Text>
      <Button label="Go to import" onPress={onGo} />
    </FormScreen>
  );
}
