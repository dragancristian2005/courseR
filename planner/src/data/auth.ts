import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { initFirebase } from './firebase';

export interface AuthUser {
  uid: string;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Set when Firebase is not configured; there is nothing to sign in to. */
  configError: string | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let auth;
    try {
      auth = initFirebase().auth;
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e));
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, name: u.displayName ?? u.email ?? 'Student' } : null);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (Platform.OS !== 'web') {
      throw new Error('Sign-in on this device arrives with the native app.');
    }
    await signInWithPopup(initFirebase().auth, new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(initFirebase().auth);
  }, []);

  return { user, loading, configError, signIn, signOut };
}
