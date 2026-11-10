import { stamp } from '../../src/domain/edits';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { newId } from '../../src/data/ids';
import { useStore } from '../../src/data/useStore';
import type { Exam } from '../../src/domain/types';
import { goBack } from '../../src/ui/BackLink';
import { Button } from '../../src/ui/Button';
import {
  Chips,
  DateField,
  Field,
  isDate,
  isTime,
  MSG_DATE,
  MSG_TIME,
  TimeField,
} from '../../src/ui/FormBits';
import { DeleteBlock, FormScreen, RecordGate } from '../../src/ui/FormScreen';

function ExamForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, repo } = useStore();
  const [existing] = useState(() =>
    id ? data.exams.find((e) => e.id === id && !e.deleted) : undefined,
  );
  const subjects = data.subjects.filter(
    (s) => !s.deleted && (s.attending || s.id === existing?.subjectId),
  );

  const [subject, setSubject] = useState(existing?.subjectId ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? '');
  const [start, setStart] = useState(existing?.start ?? '');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (k: string) => setTouched((t) => (t.includes(k) ? t : [...t, k]));

  const errors = {
    title: title.trim() === '' ? 'Give the exam a title.' : undefined,
    date: isDate(date) ? undefined : MSG_DATE,
    start: start === '' || isTime(start) ? undefined : MSG_TIME,
  };
  const shown = (k: keyof typeof errors) => (touched.includes(k) ? errors[k] : undefined);
  const valid = !errors.title && !errors.date && !errors.start;
  const on = (k: string, set: (v: string) => void) => (v: string) => {
    set(v);
    touch(k);
  };

  const save = () => {
    const exam: Exam = {
      id: existing?.id ?? newId(),
      subjectId: subject === '' ? null : subject,
      title: title.trim(),
      date,
      start: start === '' ? null : start,
      room: room.trim(),
      updatedAt: stamp(existing),
    };
    void repo.upsert('exams', exam);
    goBack();
  };

  return (
    <FormScreen title={existing ? 'Edit exam' : 'Add exam'}>
      <Chips
        label="Subject"
        options={[
          { value: '', label: 'No subject' },
          ...subjects.map((s) => ({ value: s.id, label: s.name })),
        ]}
        value={subject}
        onChange={setSubject}
      />
      <Field
        label="Title"
        value={title}
        onChangeText={on('title', setTitle)}
        onBlur={() => touch('title')}
        error={shown('title')}
        autoCapitalize="sentences"
      />
      <DateField
        label="Date"
        value={date}
        onChangeText={on('date', setDate)}
        onBlur={() => touch('date')}
        error={shown('date')}
        placeholder="2026-11-12"
      />
      <TimeField
        label="Start time"
        value={start}
        onChangeText={on('start', setStart)}
        onBlur={() => touch('start')}
        error={shown('start')}
        placeholder="09:00"
      />
      <Field label="Room" value={room} onChangeText={setRoom} />
      <Button label="Save exam" disabled={!valid} onPress={save} />
      {existing ? (
        <DeleteBlock
          what="exam"
          onConfirm={() => {
            void repo.remove('exams', existing.id);
            goBack();
          }}
        />
      ) : null}
    </FormScreen>
  );
}

/** The form reads its initial values once, so it mounts only after the data has loaded. */
export default function EditExam() {
  const { ready, data } = useStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!ready) return null;
  return (
    <RecordGate id={id} exists={data.exams.some((r) => r.id === id && !r.deleted)}>
      <ExamForm />
    </RecordGate>
  );
}
