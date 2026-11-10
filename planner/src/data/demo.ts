import { addDays, mondayOf } from '../domain/dates';
import type {
  ClassPattern,
  ClassType,
  Exam,
  Homework,
  ISODate,
  Link,
  Note,
  PlannerData,
  Repeat,
  SessionOverride,
  Subject,
} from '../domain/types';
import { emptyPlannerData } from './repository';

/**
 * Demo mode runs the app on sample data, with no Firebase and no sign-in.
 * Expo only inlines the literal `process.env.EXPO_PUBLIC_*`, so it is spelled out here, once.
 */
export function isDemo(): boolean {
  return process.env.EXPO_PUBLIC_DEMO === '1';
}

const T = 1;

const SUBJECTS: [string, string, string, boolean][] = [
  ['pstr', 'Programarea sistemelor de timp real', 'PSTR', true],
  ['aled', 'Algebră liniară și ecuații diferențiale', 'ALED', true],
  ['tss', 'Testarea sistemelor software', 'TSS', true],
  ['rpa', 'Robotic Process Automation', 'RPA', true],
  ['pi', 'Prelucrarea imaginilor', 'PI', true],
  ['siia', 'Sisteme inteligente și învățare automată', 'SIIA', true],
  ['ait', 'Antreprenoriat în IT', 'AIT', false],
];

const SLOT_END: Record<string, string> = {
  '08:00': '09:30',
  '09:40': '11:10',
  '11:20': '12:50',
  '13:00': '14:30',
  '14:40': '16:10',
  '16:20': '17:50',
};

// [id, subject, type, weekday, start slot, room, teacher, repeat]
const PATTERNS: [string, string, ClassType, 1 | 2 | 3 | 4 | 5, string, string, string, Repeat][] = [
  ['p-pstr-c', 'pstr', 'course', 1, '08:00', 'A02', 'Prof. Marin D.', 'every'],
  ['p-aled-s', 'aled', 'seminar', 1, '09:40', '045', 'Conf. Popescu I.', 'every'],
  ['p-tss-c', 'tss', 'course', 2, '11:20', 'A01', 'Prof. Ionescu M.', 'every'],
  ['p-rpa-l', 'rpa', 'lab', 2, '13:00', '312', 'Lect. Dumitrescu A.', 'odd'],
  ['p-pi-c', 'pi', 'course', 3, '08:00', 'A03', 'Prof. Stan R.', 'every'],
  ['p-pi-l', 'pi', 'lab', 3, '09:40', '311', 'Asist. Radu C.', 'even'],
  ['p-siia-c', 'siia', 'course', 3, '11:20', 'A02', 'Prof. Lazăr E.', 'every'],
  ['p-aled-c', 'aled', 'course', 4, '09:40', 'A01', 'Prof. Barbu T.', 'every'],
  ['p-pstr-l', 'pstr', 'lab', 4, '11:20', '314', 'Lect. Matei V.', 'every'],
  ['p-tss-l', 'tss', 'lab', 4, '14:40', '313', 'Asist. Neagu O.', 'even'],
  ['p-siia-s', 'siia', 'seminar', 5, '08:00', '046', 'Lect. Florea G.', 'every'],
  ['p-rpa-c', 'rpa', 'course', 5, '09:40', 'A04', 'Conf. Toma L.', 'every'],
  ['p-ait-c', 'ait', 'course', 5, '13:00', 'A02', 'Prof. Vasile N.', 'every'],
];

/** A realistic semester built around `today`, so the app always looks full. */
export function demoData(today: ISODate): PlannerData {
  const monday = mondayOf(today);
  const firstDay = addDays(monday, -21);
  const lastDay = addDays(firstDay, 7 * 14 - 3);
  const breakStart = addDays(monday, 28);

  const subjects: Subject[] = SUBJECTS.map(([id, name, abbreviation, attending]) => ({
    id,
    updatedAt: T,
    name,
    abbreviation,
    attending,
  }));

  const patterns: ClassPattern[] = PATTERNS.map(
    ([id, subjectId, type, weekday, start, room, teacher, repeat]) => ({
      id,
      updatedAt: T,
      subjectId,
      type,
      weekday,
      start,
      end: SLOT_END[start],
      room,
      teacher,
      repeat,
      validFrom: firstDay,
      validTo: null,
      online: false,
    }),
  );

  // This week's Thursday PSTR lab is moved to Friday afternoon.
  const overrides: SessionOverride[] = [
    {
      id: 'ov-pstr-l',
      updatedAt: T,
      sessionId: `p-pstr-l:${addDays(monday, 3)}`,
      kind: 'moved',
      date: addDays(monday, 4),
      start: '16:20',
      end: '17:50',
      room: '314',
    },
  ];

  const hw = (
    id: string,
    title: string,
    subjectId: string | null,
    dueOffset: number | null,
    dueTime: string | null,
    done = false,
  ): Homework => ({
    id,
    updatedAt: T,
    title,
    subjectId,
    due: dueOffset === null ? null : addDays(today, dueOffset),
    dueTime,
    done,
  });
  const homework: Homework[] = [
    hw('h1', 'Laborator 3: planificator EDF', 'pstr', -2, null),
    hw('h2', 'Fișa de probleme 4', 'aled', 0, '18:00'),
    hw('h3', 'Plan de testare pentru aplicația de rezervări', 'tss', 3, null),
    hw('h4', 'Proiect RPA: robot pentru facturi', 'rpa', 6, '23:59'),
    hw('h5', 'Filtrare și detecția muchiilor', 'pi', 12, null),
    hw('h6', 'Citit articolul despre rețele convoluționale', 'siia', null, null),
    hw('h7', 'Tema 2: valori proprii', 'aled', -6, null, true),
  ];

  const exams: Exam[] = [
    {
      id: 'e1',
      updatedAt: T,
      subjectId: 'aled',
      title: 'Examen parțial ALED',
      date: addDays(today, 9),
      start: '10:00',
      room: 'A01',
    },
    {
      id: 'e2',
      updatedAt: T,
      subjectId: 'tss',
      title: 'Colocviu TSS',
      date: addDays(today, 16),
      start: '12:00',
      room: '313',
    },
  ];

  const note = (id: string, text: string, subjectId: string | null, sessionId: string | null) =>
    ({ id, updatedAt: T, text, subjectId, sessionId, createdAt: T }) as Note;
  const notes: Note[] = [
    note('n1', 'Aduc laptopul și cablul de rețea.', 'pstr', `p-pstr-c:${monday}`),
    note('n2', 'Întrebare pentru curs: diferența dintre EDF și RMS la suprasarcină.', 'pstr', null),
    note('n3', 'Cer prelungire pentru proiectul RPA dacă nu merge conectorul.', null, null),
  ];

  const link = (id: string, title: string, url: string, subjectId: string | null): Link => ({
    id,
    updatedAt: T,
    title,
    url,
    subjectId,
  });
  const links: Link[] = [
    link('l1', 'Portalul universității', 'https://www.e-uvt.ro', null),
    link('l2', 'Google Classroom', 'https://classroom.google.com', null),
    link('l3', 'Materiale PSTR', 'https://example.com/pstr', 'pstr'),
  ];

  return {
    ...emptyPlannerData(),
    semester: {
      id: 'demo-semester',
      updatedAt: T,
      name: 'Semestrul I',
      firstDay,
      lastDay,
      breaks: [{ from: breakStart, to: addDays(breakStart, 6) }],
      parityOverrides: {},
    },
    subjects,
    patterns,
    overrides,
    exams,
    homework,
    notes,
    links,
  };
}
