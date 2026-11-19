// Verificação server-side de tokens Google OAuth / Firebase Auth

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

interface FirebaseClientConfig {
  apiKey?: string;
  oAuthClientId?: string;
}

function getFirebaseConfig(): FirebaseClientConfig {
  let fileConfig: FirebaseClientConfig = {};
  try {
    const req = createRequire(import.meta.url);
    fileConfig = req('../../firebase-applet-config.json') as FirebaseClientConfig;
  } catch {
    try {
      const raw = fs.readFileSync(
        path.join(process.cwd(), 'firebase-applet-config.json'),
        'utf8'
      );
      fileConfig = JSON.parse(raw) as FirebaseClientConfig;
    } catch {
      fileConfig = {};
    }
  }

  return {
    apiKey: process.env.FIREBASE_API_KEY || fileConfig.apiKey,
    oAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || fileConfig.oAuthClientId,
  };
}

export interface VerifiedGoogleIdentity {
  email: string;
  name: string;
  emailVerified: boolean;
  subject: string;
}

export async function verifyGoogleIdentity(params: {
  accessToken?: string | null;
  idToken?: string | null;
}): Promise<VerifiedGoogleIdentity | null> {
  const accessToken = params.accessToken?.trim() || null;
  const idToken = params.idToken?.trim() || null;

  if (!idToken) {
    return null;
  }

  const config = getFirebaseConfig();
  if (!config.apiKey) {
    return null;
  }

  // 1. Verifica Firebase ID Token estritamente vinculado ao projeto da aplicação
  let verifiedFromIdToken: VerifiedGoogleIdentity | null = null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        users?: Array<{
          localId?: string;
          email?: string;
          emailVerified?: boolean;
          displayName?: string;
        }>;
      };
      const account = data.users?.[0];
      if (account?.email && account.emailVerified === true) {
        verifiedFromIdToken = {
          email: account.email.trim().toLowerCase(),
          name: (account.displayName || account.email.split('@')[0] || 'Utilizadora').trim(),
          emailVerified: true,
          subject: account.localId || account.email,
        };
      }
    }
  } catch {
    verifiedFromIdToken = null;
  }

  if (!verifiedFromIdToken) {
    return null;
  }

  // 2. Se um OAuth accessToken também foi enviado, valida audiência e correspondência de e-mail
  if (accessToken) {
    try {
      const [infoRes, userRes] = await Promise.all([
        fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
          { cache: 'no-store' }
        ),
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }),
      ]);

      if (!infoRes.ok || !userRes.ok) {
        return null;
      }

      const tokenInfo = (await infoRes.json()) as { aud?: string; azp?: string; email_verified?: string };
      const userInfo = (await userRes.json()) as {
        email?: string;
        email_verified?: boolean;
      };

      const expectedClientId = config.oAuthClientId;
      if (
        expectedClientId &&
        tokenInfo.aud !== expectedClientId &&
        tokenInfo.azp !== expectedClientId
      ) {
        return null;
      }

      if (
        !userInfo.email ||
        userInfo.email_verified !== true ||
        userInfo.email.trim().toLowerCase() !== verifiedFromIdToken.email
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return verifiedFromIdToken;
}
