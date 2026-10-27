import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  getDocFromServer,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TenderAlert, UserAccountData, UserSectorProfile } from '../types';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with configured databaseId
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Test Firestore Connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore client is offline or initializing.');
    }
  }
}

// Structured error handler according to Firebase Integration Skill
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
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider: any) => ({
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

// Google Chat OAuth scopes
export const GOOGLE_CHAT_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
];

// In-memory token cache (never stored in localStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

const googleProvider = new GoogleAuthProvider();
GOOGLE_CHAT_SCOPES.forEach((scope) => googleProvider.addScope(scope));

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      console.warn('Google credential token empty, relying on standard Firebase Auth');
    }
    const token = credential?.accessToken || '';
    cachedAccessToken = token;
    return { user: result.user, accessToken: token };
  } catch (err: any) {
    const errorCode = err?.code || '';
    // Gracefully handle user-initiated dismissals or cancellations without raising console.error
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/user-cancelled'
    ) {
      // User dismissed the auth popup window
      return null;
    }
    if (errorCode === 'auth/popup-blocked') {
      console.warn('Google sign-in popup was blocked by browser or iframe policy');
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups or use Email / One-Click Demo Sign-In.');
    }
    console.error('Google sign-in error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const emailPasswordSignUp = async (
  email: string,
  pass: string,
  displayName: string,
  companyName: string
): Promise<User> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    // Save to Firestore
    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: displayName || email.split('@')[0],
      companyName: companyName || 'Engineering & Infrastructure Ltd.',
      role: 'estimator',
      createdAt: new Date().toISOString(),
    });
    return cred.user;
  } catch (err) {
    console.error('Sign up error:', err);
    throw err;
  }
};

export const emailPasswordSignIn = async (email: string, pass: string): Promise<User> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (err) {
    console.error('Sign in error:', err);
    throw err;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// ================= FIRESTORE USER PROFILE & SECTOR PROFILE =================
export const saveUserSectorProfile = async (
  userId: string,
  profile: Partial<UserSectorProfile>
): Promise<void> => {
  const path = `users/${userId}/sector_profile/default`;
  try {
    const profileRef = doc(db, 'users', userId, 'sector_profile', 'default');
    await setDoc(
      profileRef,
      {
        userId,
        targetSectors: profile.targetSectors || ['Civil Construction'],
        minBudget: profile.minBudget ?? 1000000,
        maxBudget: profile.maxBudget ?? 100000000,
        preferredStates: profile.preferredStates || ['All India', 'National Capital Region'],
        emailAlertsEnabled: profile.emailAlertsEnabled ?? true,
        alertEmail: profile.alertEmail || auth.currentUser?.email || 'arunkumarak5808@gmail.com',
        inAppAlertsEnabled: profile.inAppAlertsEnabled ?? true,
        googleChatAlertsEnabled: profile.googleChatAlertsEnabled ?? false,
        minFitScoreThreshold: profile.minFitScoreThreshold ?? 70,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
};

export const getUserSectorProfile = async (
  userId: string
): Promise<UserSectorProfile | null> => {
  const path = `users/${userId}/sector_profile/default`;
  try {
    const profileRef = doc(db, 'users', userId, 'sector_profile', 'default');
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      return snap.data() as UserSectorProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
};

export const getUserAlerts = async (userId: string): Promise<TenderAlert[]> => {
  const path = `users/${userId}/alerts`;
  try {
    const colRef = collection(db, 'users', userId, 'alerts');
    const snap = await getDocs(colRef);
    const alerts: TenderAlert[] = [];
    snap.forEach((d) => {
      alerts.push({ id: d.id, ...(d.data() as any) });
    });
    // Sort descending by createdAt
    return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
};

export const markAlertAsRead = async (userId: string, alertId: string): Promise<void> => {
  const path = `users/${userId}/alerts/${alertId}`;
  try {
    const alertRef = doc(db, 'users', userId, 'alerts', alertId);
    await updateDoc(alertRef, { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
};
