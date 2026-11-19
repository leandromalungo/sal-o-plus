'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

let cachedAccessToken: string | null = null;
let cachedIdToken: string | null = null;
let isSigningIn = false;
let authListenerInitialized = false;

function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  const auth = getAuth(app);

  if (!authListenerInitialized) {
    authListenerInitialized = true;
    onAuthStateChanged(auth, (user: User | null) => {
      if (!user && !isSigningIn) {
        cachedAccessToken = null;
        cachedIdToken = null;
      }
    });
  }

  return auth;
}

export interface GoogleSignInResult {
  accessToken: string | null;
  idToken: string;
  email: string;
  name: string;
  photoUrl: string | null;
}

export async function signInWithGooglePopup(): Promise<GoogleSignInResult> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'select_account' });

  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken ?? null;
    const idToken = await result.user.getIdToken();

    cachedAccessToken = accessToken;
    cachedIdToken = idToken;

    return {
      accessToken,
      idToken,
      email: result.user.email || '',
      name: result.user.displayName || result.user.email?.split('@')[0] || 'Utilizadora',
      photoUrl: result.user.photoURL,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function getActiveGoogleTokens(): Promise<{
  accessToken: string | null;
  idToken: string | null;
}> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) {
    try {
      cachedIdToken = await auth.currentUser.getIdToken();
    } catch {
      // mantém token em memória se refresh falhar
    }
  }
  return {
    accessToken: cachedAccessToken,
    idToken: cachedIdToken,
  };
}

export async function googleSignOut(): Promise<void> {
  cachedAccessToken = null;
  cachedIdToken = null;
  if (getApps().length === 0) return;
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // ignora falhas ao limpar sessão Firebase client-side
  }
}
