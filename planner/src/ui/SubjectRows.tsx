import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import type { ClassPattern, ClassType, Subject } from "../domain/types";
import { Button } from "./Button";
import { Field } from "./FormBits";
import { Rule } from "./Rule";
import { Text } from "./Text";
import { TextButton } from "./TextButton";
import { theme } from "./theme";

const TYPE_ORDER: ClassType[] = ["course", "seminar", "lab"];

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join("");
}

/** "RPA, course, seminar and lab" / "MAT, no classes yet" */
export function subjectDetail(
  subject: Subject,
  patterns: ClassPattern[],
): string {
  const types = TYPE_ORDER.filter((t) =>
    patterns.some(
      (p) => p.subjectId === subject.id && p.type === t && !p.deleted,
    ),
  );
  if (types.length === 0) return `${subject.abbreviation}, no classes yet`;
  const list =
    types.length === 1
      ? types[0]
      : `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`;
  return `${subject.abbreviation}, ${list}`;
}

export function SubjectRow({
  subject,
  detail,
  onToggle,
  onEdit,
}: {
  subject: Subject;
  detail: string;
  onToggle: (attending: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.name}>{subject.name}</Text>
          <Text variant="meta">{detail}</Text>
        </View>
        <TextButton
          label="Edit"
          accessibilityLabel={`Edit ${subject.name}`}
          onPress={onEdit}
        />
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={subject.name}
          accessibilityState={{ checked: subject.attending }}
          onPress={() => onToggle(!subject.attending)}
          style={styles.switchHit}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Switch
              value={subject.attending}
              trackColor={{ true: theme.color.ink, false: theme.color.rule }}
            />
          </View>
        </Pressable>
      </View>
      <Rule weight="hair" />
    </View>
  );
}

/** Inline Name / Short name form. Short name follows the name's initials until edited. */
export function SubjectForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Subject;
  onSave: (v: { name: string; abbreviation: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [short, setShort] = useState<string | null>(
    initial?.abbreviation ?? null,
  );
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (k: string) =>
    setTouched((t) => (t.includes(k) ? t : [...t, k]));
  const shortValue = short ?? initialsOf(name);
  const nameError =
    name.trim() === "" ? "Enter the subject’s name." : undefined;
  const shortError =
    shortValue.trim() === "" ? "Enter a short name." : undefined;

  return (
    <View style={styles.form}>
      <Field
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          touch("name");
        }}
        onBlur={() => touch("name")}
        error={touched.includes("name") ? nameError : undefined}
        autoCapitalize="words"
      />
      <Field
        label="Short name"
        value={shortValue}
        onChangeText={(v) => {
          setShort(v);
          touch("short");
        }}
        onBlur={() => touch("short")}
        error={touched.includes("short") ? shortError : undefined}
      />
      <View style={styles.buttons}>
        <Button
          label="Save subject"
          disabled={Boolean(nameError || shortError)}
          onPress={() =>
            onSave({ name: name.trim(), abbreviation: shortValue.trim() })
          }
        />
        <Button label="Cancel" kind="outline" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingVertical: theme.space(1),
  },
  text: { flex: 1 },
  switchHit: {
    minHeight: 56,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: theme.font.appBold },
  form: { gap: theme.space(3), paddingVertical: theme.space(3) },
  buttons: { flexDirection: "row", gap: theme.space(3), flexWrap: "wrap" },
});
