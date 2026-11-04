import { stamp } from '../../src/domain/edits';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { newId } from '../../src/data/ids';
import { useStore } from '../../src/data/useStore';
import { isSafeLinkUrl, normalizeLinkUrl } from '../../src/domain/links';
import type { Link } from '../../src/domain/types';
import { goBack } from '../../src/ui/BackLink';
import { Button } from '../../src/ui/Button';
import { Chips, Field } from '../../src/ui/FormBits';
import { DeleteBlock, FormScreen, RecordGate } from '../../src/ui/FormScreen';

const MSG_UNSAFE = 'Use a web address that starts with https://.';

function LinkForm() {
  const { id, subjectId } = useLocalSearchParams<{
    id?: string;
    subjectId?: string;
  }>();
  const { data, repo } = useStore();
  const [existing] = useState(() =>
    id ? data.links.find((l) => l.id === id && !l.deleted) : undefined,
  );
  const subjects = data.subjects.filter(
    (s) => !s.deleted && (s.attending || s.id === existing?.subjectId),
  );

  const [title, setTitle] = useState(existing?.title ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [owner, setOwner] = useState(existing ? (existing.subjectId ?? '') : (subjectId ?? ''));
  const [touched, setTouched] = useState<string[]>([]);
  const touch = (k: string) => setTouched((t) => (t.includes(k) ? t : [...t, k]));

  const normalized = normalizeLinkUrl(url);
  const errors = {
    title: title.trim() === '' ? 'Give the link a name.' : undefined,
    url:
      url.trim() === ''
        ? 'Enter a web address.'
        : isSafeLinkUrl(normalized)
          ? undefined
          : MSG_UNSAFE,
  };
  const shown = (k: keyof typeof errors) => (touched.includes(k) ? errors[k] : undefined);
  const valid = !errors.title && !errors.url;
  const on = (k: string, set: (v: string) => void) => (v: string) => {
    set(v);
    touch(k);
  };

  const save = () => {
    if (!valid) return;
    const link: Link = {
      id: existing?.id ?? newId(),
      title: title.trim(),
      url: normalized,
      subjectId: owner === '' ? null : owner,
      updatedAt: stamp(existing),
    };
    void repo.upsert('links', link);
    goBack();
  };

  return (
    <FormScreen title={existing ? 'Edit link' : 'Add link'}>
      <Field
        label="Title"
        value={title}
        onChangeText={on('title', setTitle)}
        onBlur={() => touch('title')}
        error={shown('title')}
        autoCapitalize="sentences"
      />
      <Field
        label="Address"
        value={url}
        onChangeText={on('url', setUrl)}
        onBlur={() => touch('url')}
        error={shown('url')}
        placeholder="portal.uvt.ro"
      />
      <Chips
        label="Belongs to"
        options={[
          { value: '', label: 'University' },
          ...subjects.map((s) => ({ value: s.id, label: s.name })),
        ]}
        value={owner}
        onChange={setOwner}
      />
      <Button label="Save link" disabled={!valid} onPress={save} />
      {existing ? (
        <DeleteBlock
          what="link"
          onConfirm={() => {
            void repo.remove('links', existing.id);
            goBack();
          }}
        />
      ) : null}
    </FormScreen>
  );
}

/** The form reads its initial values once, so it mounts only after the data has loaded. */
export default function EditLink() {
  const { ready, data } = useStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!ready) return null;
  return (
    <RecordGate id={id} exists={data.links.some((r) => r.id === id && !r.deleted)}>
      <LinkForm />
    </RecordGate>
  );
}
