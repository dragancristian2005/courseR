import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { newId } from "../../src/data/ids";
import { useStore } from "../../src/data/useStore";
import type { Note } from "../../src/domain/types";
import { goBack } from "../../src/ui/BackLink";
import { Button } from "../../src/ui/Button";
import { Chips, styles as formStyles } from "../../src/ui/FormBits";
import {
  DeleteBlock,
  FormScreen,
  MissingRecord,
} from "../../src/ui/FormScreen";
import { sessionRef, shortDate } from "../../src/ui/format";
import { Text } from "../../src/ui/Text";
import { theme } from "../../src/ui/theme";

const NONE = "none";
const SESSION = "session";

function NoteForm() {
  const params = useLocalSearchParams<{
    id?: string;
    sessionId?: string;
    subjectId?: string;
  }>();
  const { data, repo } = useStore();
  const existing = params.id
    ? data.notes.find((n) => n.id === params.id && !n.deleted)
    : undefined;
  const sessionId = existing ? existing.sessionId : (params.sessionId ?? null);
  const ref = sessionRef(data, sessionId);
  const subjects = data.subjects.filter(
    (s) => !s.deleted && (s.attending || s.id === existing?.subjectId),
  );

  const initialLink = sessionId
    ? SESSION
    : existing?.subjectId
      ? existing.subjectId
      : !existing && params.subjectId
        ? params.subjectId
        : NONE;
  const [text, setText] = useState(existing?.text ?? "");
  const [link, setLink] = useState(initialLink);
  const [touched, setTouched] = useState(false);

  const error = text.trim() === "" ? "Write something first." : undefined;

  const options = [
    { value: NONE, label: "Not linked" },
    ...(sessionId
      ? [
          {
            value: SESSION,
            label: ref
              ? `This class: ${[
                  ref.subject?.abbreviation,
                  ref.pattern.type,
                  "on",
                  shortDate(ref.date),
                ]
                  .filter(Boolean)
                  .join(" ")}`
              : "This class (no longer in your timetable)",
          },
        ]
      : []),
    ...subjects.map((s) => ({
      value: s.id,
      label: `${s.name}, whole subject`,
    })),
  ];

  const save = () => {
    const note: Note = {
      id: existing?.id ?? newId(),
      text: text.trim(),
      sessionId: link === SESSION ? sessionId : null,
      subjectId:
        link === SESSION
          ? (ref?.pattern.subjectId ?? existing?.subjectId ?? null)
          : link === NONE
            ? null
            : link,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    void repo.upsert("notes", note);
    goBack();
  };

  return (
    <FormScreen title={existing ? "Edit note" : "New note"}>
      <View style={formStyles.field}>
        <Text variant="meta">Text</Text>
        <TextInput
          accessibilityLabel="Text"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setTouched(true);
          }}
          onBlur={() => setTouched(true)}
          multiline
          textAlignVertical="top"
          placeholderTextColor={theme.color.muted}
          style={[
            formStyles.input,
            styles.text,
            touched && error ? formStyles.inputError : null,
          ]}
        />
        {touched && error ? (
          <Text style={formStyles.error}>{error}</Text>
        ) : null}
      </View>
      <Chips
        label="Linked to"
        options={options}
        value={link}
        onChange={setLink}
      />
      <Button label="Save note" disabled={!!error} onPress={save} />
      {existing ? (
        <DeleteBlock
          what="note"
          onConfirm={() => {
            void repo.remove("notes", existing.id);
            goBack();
          }}
        />
      ) : null}
    </FormScreen>
  );
}

/** The form reads its initial values once, so it mounts only after the data has loaded. */
export default function EditNote() {
  const { ready, data } = useStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!ready) return null;
  if (id && !data.notes.some((r) => r.id === id && !r.deleted))
    return <MissingRecord />;
  return <NoteForm />;
}

const styles = StyleSheet.create({
  text: {
    minHeight: 160,
    paddingVertical: theme.space(3),
    fontFamily: theme.font.note,
    fontSize: 18,
  },
});
