import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { theme } from "./theme";

export function TextButton({
  label,
  onPress,
  urgent = false,
  accessibilityLabel,
  expanded,
}: {
  label: string;
  onPress: () => void;
  urgent?: boolean;
  accessibilityLabel?: string;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={styles.hit}
    >
      <Text style={[styles.label, urgent && styles.urgent]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  label: { fontFamily: theme.font.appBold, color: theme.color.ink },
  urgent: { color: theme.color.now },
});
