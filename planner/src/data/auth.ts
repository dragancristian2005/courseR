import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { initFirebase } from "./firebase";

export interface AuthUser {
  uid: string;
  name: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Set when Firebase is not configured; there is nothing to sign in to. */
  configError: string | null;
  /** True when a sign-in that returned from a redirect failed. */
  redirectFailed?: boolean;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export interface BrowserEnv {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
}

/**
 * Popups are unreliable in an iOS home-screen app, so an installed (standalone)
 * app signs in by redirect; a normal browser tab keeps the popup.
 */
export function chooseSignInMethod(env: BrowserEnv): "popup" | "redirect" {
  const standalone =
    (env.matchMedia?.("(display-mode: standalone)").matches ?? false) ||
    env.navigator?.standalone === true;
  return standalone ? "redirect" : "popup";
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [redirectFailed, setRedirectFailed] = useState(false);

  useEffect(() => {
    let auth;
    try {
      auth = initFirebase().auth;
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e));
      setLoading(false);
      return;
    }
    if (Platform.OS === "web") {
      getRedirectResult(auth).catch(() => setRedirectFailed(true));
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(
        u ? { uid: u.uid, name: u.displayName ?? u.email ?? "Student" } : null,
      );
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (Platform.OS !== "web") {
      throw new Error("Sign-in on this device arrives with the native app.");
    }
    setRedirectFailed(false);
    const { auth } = initFirebase();
    const provider = new GoogleAuthProvider();
    const env = globalThis as unknown as BrowserEnv;
    if (
      chooseSignInMethod({
        matchMedia: env.matchMedia?.bind(env),
        navigator: (env as any).navigator,
      }) === "redirect"
    ) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(initFirebase().auth);
  }, []);

  return { user, loading, configError, redirectFailed, signIn, signOut };
}
