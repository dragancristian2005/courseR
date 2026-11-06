import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { copyText } from '../../src/data/clipboard';
import { buildPrompt } from '../../src/domain/importPrompt';
import { Button } from '../../src/ui/Button';
import { FormScreen } from '../../src/ui/FormScreen';
import { ImportSteps } from '../../src/ui/ImportSteps';
import { toKind } from '../../src/ui/importKind';
import { openLink } from '../../src/ui/openLink';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { TextButton } from '../../src/ui/TextButton';
import { theme } from '../../src/ui/theme';

const COPIED = 'Prompt copied.';
const COPY_FAILED = 'Couldn’t copy. Open “Show the prompt” and copy it by hand.';

export default function ImportPrompt() {
  const kind = toKind(useLocalSearchParams<{ kind?: string }>().kind);
  const prompt = buildPrompt(kind);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(prompt);
    if (timer.current) clearTimeout(timer.current);
    if (ok) {
      setMessage({ text: COPIED, failed: false });
      timer.current = setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ text: COPY_FAILED, failed: true });
    }
  };

  return (
    <FormScreen title="Import">
      <Rule weight="heavy" />
      <ImportSteps current={1} />
      <Text>
        {`Copy this prompt, open the Claude app, attach a photo or PDF of your ${
          kind === 'exams' ? 'exam schedule' : 'timetable'
        }, paste the prompt and send it.`}
      </Text>
      <View style={styles.buttons}>
        <Button label="Copy prompt" onPress={() => void copy()} />
        <Button
          label="Open Claude"
          kind="outline"
          onPress={() => openLink('https://claude.ai/new')}
        />
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={message.failed ? styles.failed : undefined}>
          {message.text}
        </Text>
      ) : null}
      <View style={styles.reveal}>
        <TextButton label="Show the prompt" expanded={shown} onPress={() => setShown((s) => !s)} />
        {shown ? (
          <Text selectable variant="meta">
            {prompt}
          </Text>
        ) : null}
      </View>
      <Button
        label="Next: paste the answer"
        onPress={() => router.push(`/import/paste?kind=${kind}`)}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: theme.space(3) },
  failed: { color: theme.color.now },
  reveal: { gap: theme.space(2), alignItems: 'flex-start' },
});
