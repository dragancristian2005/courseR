import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
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

/** Initialises Firebase once. Throws if the EXPO_PUBLIC_FIREBASE_* variables are missing. */
export function initFirebase(): FirebaseServices {
  if (services) return services;

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

  const app = getApps().length ? getApp() : initializeApp(config);
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
