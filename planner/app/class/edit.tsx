import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { newId } from "../../src/data/ids";
import { useStore } from "../../src/data/useStore";
import { todayISO } from "../../src/domain/dates";
import type {
  ClassPattern,
  ClassType,
  Repeat,
  Subject,
} from "../../src/domain/types";
import { BackLink } from "../../src/ui/BackLink";
import { Button } from "../../src/ui/Button";
import {
  REPEAT_OPTIONS,
  TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
} from "../../src/ui/ChangeForm";
import { Chips, Field, timeErrors } from "../../src/ui/FormBits";
import { Text } from "../../src/ui/Text";
import { theme } from "../../src/ui/theme";

const NEW = "__new_subject__";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join("");
}

export default function EditClass() {
  const { data, repo } = useStore();
  const subjects = data.subjects.filter((s) => !s.deleted);
  const [chosen, setChosen] = useState<string | null>(null);
  const subjectId = chosen ?? (subjects.length === 0 ? NEW : null);
  const setSubjectId = setChosen;
  const [name, setName] = useState("");
  const [short, setShort] = useState<string | null>(null);
  const [type, setType] = useState<ClassType>("course");
  const [weekday, setWeekday] = useState<number>(1);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:30");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("every");
  const [online, setOnline] = useState(false);
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (k: string) =>
    setTouched((t) => (t.includes(k) ? t : [...t, k]));

  const isNew = subjectId === NEW;
  const shortValue = short ?? initialsOf(name);
  const errors = timeErrors(start, end);
  const subjectError =
    touched.length === 0
      ? undefined
      : subjectId === null
        ? "Choose a subject."
        : undefined;
  const nameError =
    isNew && touched.includes("name") && name.trim() === ""
      ? "Enter the subject’s name."
      : undefined;
  const valid =
    subjectId !== null &&
    !(isNew && name.trim() === "") &&
    !errors.start &&
    !errors.end;

  const save = () => {
    let sid = subjectId as string;
    if (isNew) {
      const subject: Subject = {
        id: newId(),
        name: name.trim(),
        abbreviation: shortValue.trim() || initialsOf(name),
        attending: true,
        updatedAt: Date.now(),
      };
      sid = subject.id;
      void repo.upsert("subjects", subject);
    }
    const pattern: ClassPattern = {
      id: newId(),
      subjectId: sid,
      type,
      weekday: weekday as ClassPattern["weekday"],
      start,
      end,
      room: online ? "" : room.trim(),
      teacher: teacher.trim(),
      repeat,
      validFrom: data.semester?.firstDay ?? todayISO(),
      validTo: null,
      online,
      updatedAt: Date.now(),
    };
    void repo.upsert("patterns", pattern);
    router.replace("/");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <BackLink />
        <Text style={styles.title}>Add a class</Text>
        <Chips
          label="Subject"
          options={[
            ...subjects.map((s) => ({ value: s.id, label: s.name })),
            { value: NEW, label: "New subject" },
          ]}
          value={subjectId}
          onChange={setSubjectId}
        />
        {subjectError ? <Text style={styles.error}>{subjectError}</Text> : null}
        {isNew ? (
          <>
            <Field
              label="Name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                touch("name");
              }}
              onBlur={() => touch("name")}
              error={nameError}
              autoCapitalize="words"
            />
            <Field
              label="Short name"
              value={shortValue}
              onChangeText={setShort}
            />
          </>
        ) : null}
        <Chips
          label="Type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
        />
        <Chips
          label="Weekday"
          options={WEEKDAY_OPTIONS}
          value={weekday}
          onChange={setWeekday}
        />
        <Field
          label="Start"
          value={start}
          onChangeText={(v) => {
            setStart(v);
            touch("start");
          }}
          error={touched.includes("start") ? errors.start : undefined}
          placeholder="09:40"
        />
        <Field
          label="End"
          value={end}
          onChangeText={(v) => {
            setEnd(v);
            touch("end");
          }}
          error={touched.includes("end") ? errors.end : undefined}
          placeholder="11:10"
        />
        {online ? null : (
          <Field label="Room" value={room} onChangeText={setRoom} />
        )}
        <Field
          label="Teacher"
          value={teacher}
          onChangeText={setTeacher}
          autoCapitalize="words"
        />
        <Chips
          label="Repeats"
          options={REPEAT_OPTIONS}
          value={repeat}
          onChange={setRepeat}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Online</Text>
          <Switch
            accessibilityLabel="Online"
            value={online}
            onValueChange={setOnline}
            trackColor={{ true: theme.color.ink, false: theme.color.rule }}
          />
        </View>
        <Button label="Save class" disabled={!valid} onPress={save} />
      </View>
    </ScrollView>
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
  error: {
    color: theme.color.now,
    fontFamily: theme.font.appBold,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  switchLabel: { fontFamily: theme.font.appBold },
});
