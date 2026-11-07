// THROWAWAY SPIKE (Phase 6): checks whether this Google account may read Google Classroom
// through the app. Not linked from the UI; open /dev/classroom in a normal Safari or
// Chrome tab (not the installed app). Delete once the real import is built.
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { initFirebase } from '../../src/data/firebase';
import { Text } from '../../src/ui/Text';
import { theme } from '../../src/ui/theme';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];

async function getJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body.error ?? body)}`);
  return body;
}

export default function ClassroomSpike() {
  const [lines, setLines] = useState<string[]>([]);
  const log = (s: string) => setLines((l) => [...l, s]);

  const run = async () => {
    setLines([]);
    try {
      const { auth } = initFirebase();
      if (!auth.currentUser) throw new Error('Sign in first.');
      const provider = new GoogleAuthProvider();
      SCOPES.forEach((s) => provider.addScope(s));
      const result = await reauthenticateWithPopup(auth.currentUser, provider);
      const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
      if (!token) throw new Error('No access token returned.');
      log(`Signed in as ${result.user.email}. Got a Classroom token.`);
      const courses = await getJson(
        'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=50',
        token,
      );
      const list: any[] = courses.courses ?? [];
      log(`Active courses: ${list.length}`);
      for (const c of list.slice(0, 10)) {
        log(`• ${c.name}${c.section ? ` (${c.section})` : ''}`);
        try {
          const work = await getJson(
            `https://classroom.googleapis.com/v1/courses/${c.id}/courseWork?pageSize=20`,
            token,
          );
          for (const w of (work.courseWork ?? []).slice(0, 5)) {
            const d = w.dueDate
              ? `${w.dueDate.year}-${w.dueDate.month}-${w.dueDate.day}${w.dueTime?.hours != null ? ` ${w.dueTime.hours}:${w.dueTime.minutes ?? 0} UTC` : ''}`
              : 'no due date';
            log(`    – ${w.title} (${d})`);
          }
        } catch (e) {
          log(`    coursework error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      log('Done.');
    } catch (e) {
      log(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.paper }}
      contentContainerStyle={{ padding: 20, gap: 12 }}
    >
      <Text variant="title">Classroom access test</Text>
      <Pressable
        accessibilityRole="button"
        onPress={run}
        style={{
          minHeight: 48,
          justifyContent: 'center',
          backgroundColor: theme.color.ink,
          padding: 12,
        }}
      >
        <Text style={{ color: theme.color.paper }}>Test Classroom access</Text>
      </Pressable>
      {lines.map((l, i) => (
        <Text key={i} selectable>
          {l}
        </Text>
      ))}
    </ScrollView>
  );
}
