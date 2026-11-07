import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { readText } from '../../src/data/clipboard';
import { setPending } from '../../src/data/importSession';
import { parseImport } from '../../src/domain/importParse';
import {
  isPromptExample,
  PROMPT_FIRST_LINE_EXAMS,
  PROMPT_FIRST_LINE_TIMETABLE,
} from '../../src/domain/importPrompt';
import { Button } from '../../src/ui/Button';
import { FormScreen } from '../../src/ui/FormScreen';
import { ImportSteps } from '../../src/ui/ImportSteps';
import { toKind } from '../../src/ui/importKind';
import { Rule } from '../../src/ui/Rule';
import { Text } from '../../src/ui/Text';
import { TextButton } from '../../src/ui/TextButton';
import { theme } from '../../src/ui/theme';

const MSG_PROMPT =
  'That’s the prompt, not Claude’s answer. Send it to Claude first, then copy Claude’s reply.';
const MSG_EXAMPLE =
  'That’s the example from the prompt, not your timetable. Make sure the photo or PDF was attached, then ask Claude again.';
const MSG_DENIED = 'Couldn’t read the clipboard. Paste into the box by hand.';
const MSG_EMPTY = 'The clipboard is empty. Copy Claude’s answer first.';

export default function ImportPaste() {
  const kind = toKind(useLocalSearchParams<{ kind?: string }>().kind);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const paste = async () => {
    const clip = await readText();
    if (clip === null) {
      setError(MSG_DENIED);
      return;
    }
    if (clip.trim() === '') {
      setError(MSG_EMPTY);
      return;
    }
    setText(clip);
    setError(null);
  };

  const check = () => {
    const trimmed = text.trim();
    if (
      trimmed.startsWith(PROMPT_FIRST_LINE_TIMETABLE) ||
      trimmed.startsWith(PROMPT_FIRST_LINE_EXAMS)
    ) {
      setError(MSG_PROMPT);
      return;
    }
    const result = parseImport(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.file.kind !== kind) {
      setError(
        kind === 'exams'
          ? 'This is a timetable import. Go back and choose Timetable.'
          : 'This is an exams import. Go back and choose Exams.',
      );
      return;
    }
    if (isPromptExample(result.file)) {
      setError(MSG_EXAMPLE);
      return;
    }
    setError(null);
    setPending(result.file);
    router.push(kind === 'exams' ? '/import/exams' : '/import/review');
  };

  return (
    <FormScreen title="Import">
      <Rule weight="heavy" />
      <ImportSteps current={3} />
      <View style={styles.field}>
        <Text variant="meta">Claude’s answer</Text>
        <TextInput
          accessibilityLabel="Claude’s answer"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          placeholder="Paste the whole answer here"
          placeholderTextColor={theme.color.muted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          style={[styles.input, error ? styles.inputError : null]}
        />
        {error ? (
          <Text testID="paste-error" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <TextButton label="Paste from clipboard" onPress={() => void paste()} />
        <Button label="Check answer" disabled={text.trim() === ''} onPress={check} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: theme.space(1) },
  input: {
    minHeight: 200,
    borderWidth: 2,
    borderColor: theme.color.ink,
    padding: theme.space(3),
    fontFamily: theme.font.app,
    fontSize: 16,
    color: theme.color.ink,
    backgroundColor: theme.color.paper,
  },
  inputError: { borderColor: theme.color.now },
  error: { color: theme.color.now },
  actions: { gap: theme.space(3), alignItems: 'flex-start' },
});
