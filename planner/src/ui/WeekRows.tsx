import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { compareDates } from "../domain/dates";
import type { ISODate, Parity } from "../domain/types";
import { Button } from "./Button";
import { Field, isDate } from "./FormBits";
import { Rule } from "./Rule";
import { Text } from "./Text";
import { TextButton } from "./TextButton";
import { theme } from "./theme";

export const MSG_SEM_DATE = "Enter a date like 2026-09-28.";

/** Odd/Even two-part toggle for one teaching week. */
export function WeekRow({
  number,
  dates,
  parity,
  onChange,
}: {
  number: number;
  dates: string;
  parity: Parity;
  onChange: (p: Parity) => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.number}>{`Week ${number}`}</Text>
        <Text variant="meta" style={styles.dates}>
          {dates}
        </Text>
        <View style={styles.toggle}>
          {(["odd", "even"] as Parity[]).map((p) => {
            const selected = parity === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={`Week ${number} ${p}`}
                accessibilityState={{ selected }}
                onPress={() => onChange(p)}
                style={[styles.part, selected && styles.partOn]}
              >
                <Text style={[styles.partText, selected && styles.partTextOn]}>
                  {p === "odd" ? "Odd" : "Even"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Rule weight="hair" />
    </View>
  );
}

export function BreakRow({
  dates,
  onRemove,
}: {
  dates: string;
  onRemove: () => void;
}) {
  return (
    <View>
      <View style={[styles.row, styles.breakRow]}>
        <Text style={styles.number}>Break</Text>
        <Text variant="meta" style={styles.dates}>
          {dates}
        </Text>
        <TextButton label="Remove" onPress={onRemove} />
      </View>
      <Rule weight="hair" />
    </View>
  );
}

/** Inline From/To form. `bounds` is the semester span the break must overlap. */
export function BreakForm({
  bounds,
  onAdd,
  onCancel,
}: {
  bounds: { first: ISODate; last: ISODate } | null;
  onAdd: (b: { from: ISODate; to: ISODate }) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (k: string) =>
    setTouched((t) => (t.includes(k) ? t : [...t, k]));

  const fromOk = isDate(from);
  const toOk = isDate(to);
  let toError: string | undefined;
  let fromError: string | undefined;
  if (!fromOk) fromError = MSG_SEM_DATE;
  if (!toOk) toError = MSG_SEM_DATE;
  else if (fromOk && compareDates(to, from) < 0)
    toError = "The break must end after it starts.";
  else if (
    fromOk &&
    bounds &&
    (compareDates(to, bounds.first) < 0 || compareDates(from, bounds.last) > 0)
  )
    toError = "The break must be inside the semester.";
  const valid = !fromError && !toError;

  return (
    <View style={styles.form}>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label="From"
            value={from}
            onChangeText={(v) => {
              setFrom(v);
              touch("from");
            }}
            error={touched.includes("from") ? fromError : undefined}
            placeholder="2026-12-21"
          />
        </View>
        <View style={styles.half}>
          <Field
            label="To"
            value={to}
            onChangeText={(v) => {
              setTo(v);
              touch("to");
            }}
            error={touched.includes("to") ? toError : undefined}
            placeholder="2027-01-03"
          />
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          label="Add break"
          disabled={!valid}
          onPress={() => onAdd({ from, to })}
        />
        <Button label="Cancel" kind="outline" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingVertical: theme.space(1),
  },
  breakRow: {
    backgroundColor: theme.color.rule,
    paddingHorizontal: theme.space(2),
  },
  number: { fontFamily: theme.font.appBold, minWidth: 64 },
  dates: { flex: 1 },
  toggle: { flexDirection: "row" },
  part: {
    minHeight: 44,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  partOn: { backgroundColor: theme.color.ink },
  partText: { fontFamily: theme.font.appBold, fontSize: 14 },
  partTextOn: { color: theme.color.paper },
  form: { gap: theme.space(3) },
  pair: { flexDirection: "row", gap: theme.space(3) },
  half: { flex: 1 },
  buttons: { flexDirection: "row", gap: theme.space(3), flexWrap: "wrap" },
});
