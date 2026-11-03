import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../src/data/auth';
import { initFirebase } from '../src/data/firebase';
import { createFirestoreRepository } from '../src/data/firestoreRepository';
import { StoreProvider } from '../src/data/StoreProvider';
import { useStore } from '../src/data/useStore';
import SignIn from './sign-in';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function ReadyGate({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();
  return ready ? <>{children}</> : null;
}

export default function RootLayout() {
  const { user, loading } = useAuth();
  const uid = user?.uid;
  const repository = useMemo(() => (uid ? createFirestoreRepository(initFirebase().db, uid) : null), [uid]);

  const [loaded, error] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_800ExtraBold,
    Newsreader_400Regular_Italic,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded || loading) return null;
  if (!repository) return <SignIn />;

  return (
    <StoreProvider repository={repository}>
      <ReadyGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ReadyGate>
    </StoreProvider>
  );
}
