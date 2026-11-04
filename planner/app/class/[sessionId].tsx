import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { ClassDetail } from "../../src/ui/ClassDetail";
import { theme } from "../../src/ui/theme";

export default function ClassScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <ClassDetail sessionId={String(sessionId ?? "")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.paper },
  content: { alignItems: "center", paddingBottom: theme.space(8) },
  inner: { width: "100%", maxWidth: 720 },
});
