import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useStore } from "../../src/data/useStore";
import { addDays, compareDates } from "../../src/domain/dates";
import type { ISODate, Parity, Semester } from "../../src/domain/types";
import { buildWeeks } from "../../src/domain/weeks";
import { Button } from "../../src/ui/Button";
import { Field, isDate } from "../../src/ui/FormBits";
import { FormScreen } from "../../src/ui/FormScreen";
import { dayRange } from "../../src/ui/format";
import { Rule } from "../../src/ui/Rule";
import { Text } from "../../src/ui/Text";
import { theme } from "../../src/ui/theme";
import {
  BreakForm,
  BreakRow,
  MSG_SEM_DATE,
  WeekRow,
} from "../../src/ui/WeekRows";

type Break = { from: ISODate; to: ISODate };

export default function SemesterScreen() {
  const { ready } = useStore();
  return ready ? <SemesterSetup /> : null;
}

function SemesterSetup() {
  const { data, repo } = useStore();
  const existing = data.semester;
  const [name, setName] = useState(existing?.name ?? "This semester");
  const [firstDay, setFirstDay] = useState(existing?.firstDay ?? "");
  const [lastDay, setLastDay] = useState(existing?.lastDay ?? "");
  const [breaks, setBreaks] = useState<Break[]>(existing?.breaks ?? []);
  const [overrides, setOverrides] = useState<Record<number, Parity>>(
    existing?.parityOverrides ?? {},
  );
  const [touched, setTouched] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const touch = (k: string) =>
    setTouched((t) => (t.includes(k) ? t : [...t, k]));
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setSaved(false);
    };

  const firstOk = isDate(firstDay);
  const lastOk = isDate(lastDay);
  const ordered = firstOk && lastOk && compareDates(lastDay, firstDay) >= 0;
  const orderError =
    firstOk && lastOk && !ordered
      ? "The last day must be after the first day."
      : undefined;

  const sortedBreaks = [...breaks].sort((a, b) => compareDates(a.from, b.from));
  const draft: Semester = {
    id: existing?.id ?? "semester",
    updatedAt: 0,
    name: name.trim() || "This semester",
    firstDay,
    lastDay,
    breaks: sortedBreaks,
    parityOverrides: overrides,
  };
  const weeks = ordered ? buildWeeks(draft) : [];
  const weekCount = weeks.filter((w) => !w.isBreak).length;
  // Overrides for weeks that no longer exist are dropped.
  const keptOverrides: Record<number, Parity> = {};
  for (const [k, v] of Object.entries(overrides))
    if (Number(k) <= weekCount) keptOverrides[Number(k)] = v;

  const setParity = (n: number, p: Parity) => {
    const natural: Parity = n % 2 === 1 ? "odd" : "even";
    const next = { ...keptOverrides };
    if (p === natural) delete next[n];
    else next[n] = p;
    setOverrides(next);
    setSaved(false);
  };

  const rows: React.ReactNode[] = [];
  const shown = new Set<Break>();
  for (const w of weeks) {
    if (!w.isBreak) {
      rows.push(
        <WeekRow
          key={w.monday}
          number={w.number as number}
          dates={dayRange(w.monday, addDays(w.monday, 4))}
          parity={w.parity as Parity}
          onChange={(p) => setParity(w.number as number, p)}
        />,
      );
      continue;
    }
    const b = sortedBreaks.find(
      (x) =>
        compareDates(w.monday, x.from) >= 0 &&
        compareDates(w.monday, x.to) <= 0,
    );
    if (b && !shown.has(b)) {
      shown.add(b);
      rows.push(breakRow(b));
    }
  }
  for (const b of sortedBreaks)
    if (ordered && !shown.has(b)) rows.push(breakRow(b));

  function breakRow(b: Break) {
    return (
      <BreakRow
        key={`${b.from}_${b.to}`}
        dates={dayRange(b.from, b.to)}
        onRemove={() => {
          setBreaks(breaks.filter((x) => x !== b));
          setSaved(false);
        }}
      />
    );
  }

  const save = () => {
    void repo.saveSemester({
      ...draft,
      parityOverrides: keptOverrides,
      updatedAt: Date.now(),
    });
    setSaved(true);
  };

  return (
    <FormScreen title={draft.name}>
      <Rule weight="heavy" />
      <Field
        label="Name"
        value={name}
        onChangeText={edit(setName)}
        autoCapitalize="words"
      />
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            label="First day of classes"
            value={firstDay}
            onChangeText={(v) => {
              edit(setFirstDay)(v);
              touch("first");
            }}
            error={
              touched.includes("first") && !firstOk ? MSG_SEM_DATE : undefined
            }
            placeholder="2026-09-28"
          />
        </View>
        <View style={styles.half}>
          <Field
            label="Last day of classes"
            value={lastDay}
            onChangeText={(v) => {
              edit(setLastDay)(v);
              touch("last");
            }}
            error={
              touched.includes("last") && !lastOk ? MSG_SEM_DATE : orderError
            }
            placeholder="2027-01-15"
          />
        </View>
      </View>
      <Text variant="meta">
        Holidays don’t count as weeks. If your faculty numbers a week
        differently, change its odd/even here.
      </Text>
      {rows.length > 0 ? (
        <View>
          <Rule weight="hair" />
          {rows}
        </View>
      ) : null}
      {adding ? (
        <BreakForm
          bounds={ordered ? { first: firstDay, last: lastDay } : null}
          onAdd={(b) => {
            setBreaks([...breaks, b]);
            setAdding(false);
            setSaved(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          kind="outline"
          label="Add a break"
          onPress={() => setAdding(true)}
        />
      )}
      <Button label="Save semester" disabled={!ordered} onPress={save} />
      {saved ? <Text accessibilityRole="alert">Semester saved.</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: theme.space(3) },
  half: { flex: 1 },
});
