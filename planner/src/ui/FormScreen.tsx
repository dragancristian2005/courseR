import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BackLink, goBack } from "./BackLink";
import { Button } from "./Button";
import { Text } from "./Text";
import { TextButton } from "./TextButton";
import { theme } from "./theme";

export function FormScreen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <BackLink />
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {children}
      </View>
    </ScrollView>
  );
}

/** "Delete homework" text button that asks "Delete this homework?" before calling onConfirm. */
export function DeleteBlock({
  what,
  onConfirm,
}: {
  what: string;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <TextButton
        urgent
        label={`Delete ${what}`}
        onPress={() => setAsking(true)}
      />
    );
  }
  return (
    <View style={styles.confirm}>
      <Text style={styles.ask}>{`Delete this ${what}?`}</Text>
      <View style={styles.buttons}>
        <Button label="Delete" onPress={onConfirm} />
        <Button
          label="Keep it"
          kind="outline"
          onPress={() => setAsking(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.paper },
  content: { alignItems: "center", paddingBottom: theme.space(8) },
  inner: {
    width: "100%",
    maxWidth: 720,
    padding: theme.space(4),
    gap: theme.space(4),
  },
  title: {
    fontFamily: theme.font.appBold,
    fontSize: 28,
    color: theme.color.ink,
  },
  confirm: { gap: theme.space(2) },
  ask: { fontFamily: theme.font.appBold, color: theme.color.now },
  buttons: { flexDirection: "row", gap: theme.space(3), flexWrap: "wrap" },
});

/** Shown when an edit screen is opened for a record that no longer exists. */
export function MissingRecord() {
  return (
    <FormScreen title="This item no longer exists.">
      <Button label="Go back" onPress={goBack} />
    </FormScreen>
  );
}
