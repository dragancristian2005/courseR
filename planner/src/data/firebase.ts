import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

function firebaseConfig() {
  // Expo only inlines literal `process.env.EXPO_PUBLIC_*` references, so each is spelled out.
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((v) => !v)) {
    throw new Error(
      'Firebase is not configured. Copy planner/.env.example to planner/.env and fill in the values.',
    );
  }
  return config as Record<keyof typeof config, string>;
}

/** Initialises Firebase once. Throws if the EXPO_PUBLIC_FIREBASE_* variables are missing. */
export function initFirebase(): FirebaseServices {
  if (services) return services;

  const config = firebaseConfig();

  const app = getApps().some((a) => a.name === '[DEFAULT]') ? getApp() : initializeApp(config);
  const db = initializeFirestore(app, {
    localCache:
      Platform.OS === 'web'
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : // Native offline persistence arrives in a later phase.
          memoryLocalCache(),
  });
  services = { app, auth: getAuth(app), db };
  return services;
}

const CLASSROOM_APP = 'classroom';
let classroomAuth: Auth | null = null;

/**
 * Auth for a secondary Firebase app, used only to let any Google account grant Classroom
 * access without touching the planner sign-in. Session persistence: nothing outlives the tab.
 */
export function initClassroomAuth(): Auth {
  if (classroomAuth) return classroomAuth;
  const existing = getApps().find((a) => a.name === CLASSROOM_APP);
  const app = existing ?? initializeApp(firebaseConfig(), CLASSROOM_APP);
  try {
    classroomAuth = initializeAuth(app, {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (e) {
    // The app already has its auth (e.g. after a hot reload emptied this module's cache).
    if ((e as { code?: unknown } | null)?.code !== 'auth/already-initialized') throw e;
    classroomAuth = getAuth(app);
  }
  return classroomAuth;
}
