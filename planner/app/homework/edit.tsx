import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { newId } from "../../src/data/ids";
import { useStore } from "../../src/data/useStore";
import type { Homework } from "../../src/domain/types";
import { goBack } from "../../src/ui/BackLink";
import { Button } from "../../src/ui/Button";
import {
  Chips,
  Field,
  isDate,
  isTime,
  MSG_DATE,
  MSG_TIME,
} from "../../src/ui/FormBits";
import { DeleteBlock, FormScreen } from "../../src/ui/FormScreen";

function HomeworkForm() {
  const { id, subjectId } = useLocalSearchParams<{
    id?: string;
    subjectId?: string;
  }>();
  const { data, repo } = useStore();
  const existing = id
    ? data.homework.find((h) => h.id === id && !h.deleted)
    : undefined;
  const subjects = data.subjects.filter(
    (s) => !s.deleted && (s.attending || s.id === existing?.subjectId),
  );

  const [title, setTitle] = useState(existing?.title ?? "");
  const [subject, setSubject] = useState(
    existing?.subjectId ?? subjectId ?? "",
  );
  const [due, setDue] = useState(existing?.due ?? "");
  const [dueTime, setDueTime] = useState(existing?.dueTime ?? "");
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (k: string) =>
    setTouched((t) => (t.includes(k) ? t : [...t, k]));

  const errors = {
    title: title.trim() === "" ? "Give the homework a title." : undefined,
    due: isDate(due) ? undefined : MSG_DATE,
    dueTime: dueTime === "" || isTime(dueTime) ? undefined : MSG_TIME,
  };
  const shown = (k: keyof typeof errors) =>
    touched.includes(k) ? errors[k] : undefined;
  const valid = !errors.title && !errors.due && !errors.dueTime;

  const save = () => {
    const hw: Homework = {
      id: existing?.id ?? newId(),
      title: title.trim(),
      subjectId: subject === "" ? null : subject,
      due,
      dueTime: dueTime === "" ? null : dueTime,
      done: existing?.done ?? false,
      updatedAt: Date.now(),
    };
    void repo.upsert("homework", hw);
    goBack();
  };

  const field =
    (k: keyof typeof errors, set: (v: string) => void) => (v: string) => {
      set(v);
      touch(k);
    };

  return (
    <FormScreen title={existing ? "Edit homework" : "Add homework"}>
      <Field
        label="Title"
        value={title}
        onChangeText={field("title", setTitle)}
        onBlur={() => touch("title")}
        error={shown("title")}
        autoCapitalize="sentences"
      />
      <Chips
        label="Subject"
        options={[
          { value: "", label: "No subject" },
          ...subjects.map((s) => ({ value: s.id, label: s.name })),
        ]}
        value={subject}
        onChange={setSubject}
      />
      <Field
        label="Due date"
        value={due}
        onChangeText={field("due", setDue)}
        onBlur={() => touch("due")}
        error={shown("due")}
        placeholder="2026-11-09"
      />
      <Field
        label="Due time"
        value={dueTime}
        onChangeText={field("dueTime", setDueTime)}
        onBlur={() => touch("dueTime")}
        error={shown("dueTime")}
        placeholder="09:40"
      />
      <Button label="Save homework" disabled={!valid} onPress={save} />
      {existing ? (
        <DeleteBlock
          what="homework"
          onConfirm={() => {
            void repo.remove("homework", existing.id);
            goBack();
          }}
        />
      ) : null}
    </FormScreen>
  );
}

/** The form reads its initial values once, so it mounts only after the data has loaded. */
export default function EditHomework() {
  const { ready } = useStore();
  return ready ? <HomeworkForm /> : null;
}
