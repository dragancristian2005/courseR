import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ISODate, Session } from "../domain/types";
import { Button } from "./Button";
import { Field, isDate, MSG_DATE, timeErrors } from "./FormBits";
import { theme } from "./theme";

export interface MoveValues {
  date: ISODate;
  start: string;
  end: string;
  room?: string;
}

export function MoveForm({
  session,
  onSave,
  onCancel,
}: {
  session: Session;
  onSave: (to: MoveValues) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(session.start);
  const [end, setEnd] = useState(session.end);
  const [room, setRoom] = useState(session.room);
  const errors = timeErrors(start, end);
  const dateError = isDate(date) ? undefined : MSG_DATE;
  const valid = !errors.start && !errors.end && !dateError;
  return (
    <View style={styles.form}>
      <Field
        label="Date"
        value={date}
        onChangeText={setDate}
        error={dateError}
        placeholder="2026-11-09"
      />
      <Field
        label="Start"
        value={start}
        onChangeText={setStart}
        error={errors.start}
        placeholder="09:40"
      />
      <Field
        label="End"
        value={end}
        onChangeText={setEnd}
        error={errors.end}
        placeholder="11:10"
      />
      {session.online ? null : (
        <Field label="Room" value={room} onChangeText={setRoom} />
      )}
      <View style={styles.buttons}>
        <Button
          label="Save move"
          disabled={!valid}
          onPress={() =>
            onSave({
              date,
              start,
              end,
              ...(session.online ? {} : { room: room.trim() }),
            })
          }
        />
        <Button label="Cancel" kind="outline" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space(3), paddingVertical: theme.space(3) },
  buttons: { flexDirection: "row", gap: theme.space(3), flexWrap: "wrap" },
});
