import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const expectedProjectId = 'rl-connect-ed797';
const env = (import.meta as any).env || {};
export const firebaseConfig = Object.freeze({
  apiKey: String(env.VITE_FIREBASE_API_KEY || 'AIzaSyBTaAot1PUq8rqX9_PShE0gIUyoptkcuWQ').trim(),
  authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || 'rl-connect-ed797.firebaseapp.com').trim(),
  projectId: String(env.VITE_FIREBASE_PROJECT_ID || expectedProjectId).trim(),
  storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET || 'rl-connect-ed797.firebasestorage.app').trim(),
  messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID || '424978245385').trim(),
  appId: String(env.VITE_FIREBASE_APP_ID || '1:424978245385:web:89a7946c5f277c13e015d8').trim(),
  measurementId: String(env.VITE_FIREBASE_MEASUREMENT_ID || 'G-0VMDCYK11M').trim(),
});
if (firebaseConfig.projectId !== expectedProjectId) throw new Error(`[Firebase] Projeto inválido: ${firebaseConfig.projectId}. Esperado: ${expectedProjectId}.`);
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
storage.maxUploadRetryTime = 12_000;
storage.maxOperationRetryTime = 12_000;
void setPersistence(auth, browserLocalPersistence).catch(error => console.error('[Firebase Auth] Persistência da sessão falhou.', error));
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
