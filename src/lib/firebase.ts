import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

// Supplied IG Meet Firebase Project Configuration (ig-meet--find-your-partner)
const DEFAULT_RTDB_URL = 'https://ig-meet--find-your-partner-default-rtdb.firebaseio.com';

const rawEnvRtdbUrl = (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined)?.trim() || '';
const isValidRtdbUrl =
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/i.test(rawEnvRtdbUrl);
const rtdbUrl = isValidRtdbUrl ? rawEnvRtdbUrl : DEFAULT_RTDB_URL;

const rawEnvWebAppId = (import.meta.env.VITE_FIREBASE_WEB_APP_ID as string | undefined)?.trim() || '';
const webAppId = /^1:\d+:web:[a-z0-9]+$/i.test(rawEnvWebAppId) ? rawEnvWebAppId : undefined;

export const firebaseConfig = {
  apiKey: 'AIzaSyAzbNGUMwNAYAqJXwLhg3wIZzR0pmPMwXI',
  authDomain: 'ig-meet--find-your-partner.firebaseapp.com',
  databaseURL: rtdbUrl,
  projectId: 'ig-meet--find-your-partner',
  storageBucket: 'ig-meet--find-your-partner.firebasestorage.app',
  messagingSenderId: '358917824526',
  ...(webAppId ? { appId: webAppId } : {})
};

export const firebaseMissingConfig: string[] = [
  ...(!webAppId ? ['Firebase Web App ID (VITE_FIREBASE_WEB_APP_ID)'] : [])
];

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

let initializedRtdb: Database | null = null;
try {
  initializedRtdb = getDatabase(app, rtdbUrl);
} catch {
  initializedRtdb = null;
}
export const rtdb: Database | null = initializedRtdb;

export const isSameFirebaseOrigin =
  typeof window !== 'undefined' &&
  (window.location.hostname === firebaseConfig.authDomain ||
    window.location.hostname === `${firebaseConfig.projectId}.web.app`);
