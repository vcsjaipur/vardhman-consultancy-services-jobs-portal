import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const sharedFirebaseConfig = {
  projectId: 'gen-lang-client-0995205990',
  appId: '1:79800413779:web:5d82fb76aa674b7f04e0a6',
  apiKey: 'AIzaSyBVrqMN8Ia5sgKzsQMOhEHjd0PGdn_HW5g',
  authDomain: 'gen-lang-client-0995205990.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixremixvardhm-67eea69c-5947-4aa9-960a-36c84f86e3c5',
  storageBucket: 'gen-lang-client-0995205990.firebasestorage.app',
  messagingSenderId: '79800413779',
};

const SHARED_APP_NAME = 'vcs-shared-portal';
const sharedApp =
  getApps().find((existing) => existing.name === SHARED_APP_NAME) ??
  initializeApp(sharedFirebaseConfig, SHARED_APP_NAME);

export const sharedDb = getFirestore(
  sharedApp,
  sharedFirebaseConfig.firestoreDatabaseId
);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(sharedDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Portal database connection unavailable.');
    }
  }
}

void testConnection();

export async function ensureVerifiedGoogleUser(): Promise<User> {
  if (auth.currentUser && auth.currentUser.emailVerified) {
    return auth.currentUser;
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}
