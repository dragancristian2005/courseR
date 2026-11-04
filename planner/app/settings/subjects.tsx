import { stamp } from "../../src/domain/edits";
import { useState } from "react";
import { View } from "react-native";
import { newId } from "../../src/data/ids";
import { useStore } from "../../src/data/useStore";
import type { Subject } from "../../src/domain/types";
import { Button } from "../../src/ui/Button";
import { FormScreen } from "../../src/ui/FormScreen";
import { Rule } from "../../src/ui/Rule";
import { SectionHeading } from "../../src/ui/Page";
import {
  SubjectForm,
  SubjectRow,
  subjectDetail,
} from "../../src/ui/SubjectRows";
import { Text } from "../../src/ui/Text";

const NEW = "__new__";

export default function Subjects() {
  const { data, repo, ready } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const subjects = data.subjects
    .filter((s) => !s.deleted)
    .sort((a, b) => a.name.localeCompare(b.name));

  const write = (s: Subject) => void repo.upsert("subjects", s);
  const saveForm = (
    existing: Subject | undefined,
    v: { name: string; abbreviation: string },
  ) => {
    write(
      existing
        ? { ...existing, ...v, updatedAt: stamp(existing) }
        : { id: newId(), ...v, attending: true, updatedAt: Date.now() },
    );
    setEditing(null);
  };

  const list = (items: Subject[]) =>
    items.map((s) => (
      <View key={s.id}>
        <SubjectRow
          subject={s}
          detail={subjectDetail(s, data.patterns)}
          onToggle={(on) =>
            write({ ...s, attending: on, updatedAt: stamp(s) })
          }
          onEdit={() => setEditing(s.id)}
        />
        {editing === s.id ? (
          <SubjectForm
            initial={s}
            onSave={(v) => saveForm(s, v)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </View>
    ));

  const attending = subjects.filter((s) => s.attending);
  const away = subjects.filter((s) => !s.attending);

  if (!ready) return null;
  return (
    <FormScreen title="Subjects">
      <Rule weight="heavy" />
      <Text variant="meta">
        Switch off what you don’t attend. It disappears from your calendar,
        reminders and widgets, and you can switch it back on anytime.
      </Text>
      {subjects.length === 0 ? (
        <Text>
          No subjects yet. Add one, or add a class and its subject is created
          for you.
        </Text>
      ) : null}
      {attending.length > 0 ? (
        <View>
          <SectionHeading>Attending</SectionHeading>
          <Rule weight="hair" />
          {list(attending)}
        </View>
      ) : null}
      {away.length > 0 ? (
        <View>
          <SectionHeading>Not attending</SectionHeading>
          <Rule weight="hair" />
          {list(away)}
        </View>
      ) : null}
      {editing === NEW ? (
        <SubjectForm
          onSave={(v) => saveForm(undefined, v)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          kind="outline"
          label="Add a subject by hand"
          onPress={() => setEditing(NEW)}
        />
      )}
    </FormScreen>
  );
}
