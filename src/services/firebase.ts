import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { CompanyProfile, TenderAlert, TenderStatus, UserSectorProfile } from '../types';

// ---------------------------------------------------------------------------
// App / Auth / Firestore initialisation
// ---------------------------------------------------------------------------

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const databaseId: string | undefined = (firebaseConfig as { firestoreDatabaseId?: string })
  .firestoreDatabaseId;

function createFirestore() {
  const id = databaseId && databaseId !== '(default)' ? databaseId : undefined;
  try {
    // Long-polling auto-detect avoids the "client is offline" failures that happen
    // behind proxies / restricted networks where WebChannel streaming is blocked.
    // The persistent cache keeps the PWA usable offline.
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      },
      id as string
    );
  } catch {
    // Already initialised (hot reload) or persistence unsupported: reuse / fall back.
    return id ? getFirestore(app, id) : getFirestore(app);
  }
}

export const db = createFirestore();

// Analytics is optional: it needs a browser, a measurementId and cookies/IndexedDB.
if (typeof window !== 'undefined' && (firebaseConfig as { measurementId?: string }).measurementId) {
  analyticsSupported()
    .then((ok) => { if (ok) getAnalytics(app); })
    .catch(() => { /* analytics unavailable: ignore */ });
}
export const auth = getAuth(app);

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/** Turns Firebase Auth error codes into messages a user (or you, in setup) can act on. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const raw = err instanceof Error ? err.message : String(err ?? '');
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase. Enable it under Authentication > Sign-in method.';
    case 'auth/unauthorized-domain':
      return `This domain is not authorised for sign-in. Add ${window.location.hostname} under Firebase Authentication > Settings > Authorized domains.`;
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists using a different sign-in method. Sign in with that method first.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return '';
    default:
      return raw || 'Authentication failed. Please try again.';
  }
}

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
  code?: string;
  operationType: OperationType;
  path: string | null;
  userId?: string | null;
}

/** Logs a structured error and rethrows an Error whose message is human-readable. */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const code = (error as { code?: string })?.code;
  const info: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    code,
    operationType,
    path,
    userId: auth.currentUser?.uid ?? null,
  };
  console.error('Firestore error', info);
  throw new Error(describeFirestoreError(code, path));
}

export function describeFirestoreError(code: string | undefined, path: string | null): string {
  switch (code) {
    case 'permission-denied':
      return 'Database access was denied. Sign in again, or deploy firestore.rules to your Firebase project.';
    case 'unauthenticated':
      return 'Your session has expired. Sign in again.';
    case 'not-found':
      return `Firestore database "${databaseId || '(default)'}" was not found. Create it in the Firebase console or fix firestoreDatabaseId in firebase-applet-config.json.`;
    case 'unavailable':
      return 'Could not reach the database. You may be offline; changes will sync when you reconnect.';
    default:
      return `Database error${path ? ` at ${path}` : ''}. Please try again.`;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// Google Chat needs restricted OAuth scopes. They are requested ONLY when the
// user explicitly connects Chat, never at ordinary sign-in.
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

// In-memory only; never persisted.
let cachedAccessToken: string | null = null;

export const getAccessToken = async (): Promise<string | null> => cachedAccessToken;
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/** Firebase ID token for authenticating calls to this app's own API. */
export const getIdToken = async (forceRefresh = false): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
};

export const initAuth = (
  onAuthSuccess: (user: User, token: string | null) => void,
  onAuthFailure: () => void
) =>
  onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });

function isCancelled(err: unknown): boolean {
  const code = (err as { code?: string })?.code || '';
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  );
}

/**
 * Creates the Firestore profile document if it does not exist yet.
 * Never throws: auth must not fail because the profile write did.
 */
export const ensureUserProfile = async (
  user: User,
  extras: { companyName?: string; primarySector?: string } = {}
): Promise<boolean> => {
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return true;

    const email = user.email || '';
    const profile: Record<string, unknown> = {
      uid: user.uid,
      email,
      displayName: user.displayName || email.split('@')[0] || 'User',
      role: 'estimator',
      createdAt: new Date().toISOString(),
    };
    if (user.photoURL) profile.photoURL = user.photoURL;
    if (extras.companyName) profile.companyName = extras.companyName;
    if (extras.primarySector) profile.primarySector = extras.primarySector;

    await setDoc(ref, profile);
    return true;
  } catch (err) {
    console.warn('Could not save user profile (will retry on next sign-in):', err);
    return false;
  }
};

/** Google sign-in with basic profile + email only. */
export const googleSignIn = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserProfile(result.user);
    return result.user;
  } catch (err) {
    if (isCancelled(err)) return null;
    throw err;
  }
};

/** Explicit opt-in for Google Chat: requests the Chat scopes and returns an access token. */
export const connectGoogleChat = async (): Promise<{ user: User; accessToken: string } | null> => {
  const provider = new GoogleAuthProvider();
  GOOGLE_CHAT_SCOPES.forEach((scope) => provider.addScope(scope));
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';
    cachedAccessToken = token || null;
    await ensureUserProfile(result.user);
    return { user: result.user, accessToken: token };
  } catch (err) {
    if (isCancelled(err)) return null;
    throw err;
  }
};

export const emailPasswordSignUp = async (
  email: string,
  pass: string,
  displayName: string,
  companyName: string,
  primarySector?: string
): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName) {
    try {
      await updateProfile(cred.user, { displayName });
    } catch (err) {
      console.warn('Could not set display name:', err);
    }
  }
  // Account exists at this point regardless of the profile write outcome.
  await ensureUserProfile(cred.user, { companyName, primarySector });
  return cred.user;
};

export const emailPasswordSignIn = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  void ensureUserProfile(cred.user);
  return cred.user;
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email.trim());
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// ---------------------------------------------------------------------------
// Firestore: private company profile and personal tender pipeline state
// ---------------------------------------------------------------------------

export interface SavedTenderState {
  tenderId: string;
  userId: string;
  status: TenderStatus;
  customNotes?: string;
  updatedAt: string;
}

export const getCompanyProfile = async (userId: string): Promise<CompanyProfile | null> => {
  const path = `users/${userId}/company_profile/default`;
  if (auth.currentUser?.uid !== userId) throw new Error('You can only read your own company profile.');
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'company_profile', 'default'));
    if (!snap.exists()) return null;
    const data = snap.data();
    const { userId: _owner, updatedAt: _updatedAt, ...profile } = data;
    return profile as CompanyProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
};

export const saveCompanyProfile = async (userId: string, profile: CompanyProfile): Promise<void> => {
  const path = `users/${userId}/company_profile/default`;
  if (auth.currentUser?.uid !== userId) throw new Error('You can only save your own company profile.');
  try {
    await setDoc(doc(db, 'users', userId, 'company_profile', 'default'), {
      ...profile,
      userId,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
};

export const getUserTenderStates = async (userId: string): Promise<Record<string, SavedTenderState>> => {
  const path = `users/${userId}/tender_states`;
  if (auth.currentUser?.uid !== userId) throw new Error('You can only read your own tender pipeline.');
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'tender_states'));
    const states: Record<string, SavedTenderState> = {};
    snap.forEach((d) => {
      states[d.id] = { tenderId: d.id, ...(d.data() as Omit<SavedTenderState, 'tenderId'>) };
    });
    return states;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
};

export const saveUserTenderState = async (
  userId: string,
  tenderId: string,
  status: TenderStatus,
  customNotes?: string
): Promise<void> => {
  const path = `users/${userId}/tender_states/${tenderId}`;
  if (auth.currentUser?.uid !== userId) throw new Error('You can only change your own tender pipeline.');
  try {
    const data: SavedTenderState = { userId, tenderId, status, updatedAt: new Date().toISOString() };
    if (typeof customNotes === 'string') data.customNotes = customNotes;
    await setDoc(doc(db, 'users', userId, 'tender_states', tenderId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
};

// ---------------------------------------------------------------------------
// Firestore: sector profile and alerts
// ---------------------------------------------------------------------------

export const saveUserSectorProfile = async (
  userId: string,
  profile: Partial<UserSectorProfile>
): Promise<void> => {
  const path = `users/${userId}/sector_profile/default`;
  try {
    const email = profile.alertEmail || auth.currentUser?.email || '';
    await setDoc(
      doc(db, 'users', userId, 'sector_profile', 'default'),
      {
        userId,
        targetSectors: profile.targetSectors || ['Civil Construction'],
        minBudget: profile.minBudget ?? 1000000,
        maxBudget: profile.maxBudget ?? 100000000,
        preferredStates: profile.preferredStates || ['All India'],
        emailAlertsEnabled: profile.emailAlertsEnabled ?? true,
        alertEmail: email,
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

export const getUserSectorProfile = async (userId: string): Promise<UserSectorProfile | null> => {
  const path = `users/${userId}/sector_profile/default`;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'sector_profile', 'default'));
    return snap.exists() ? (snap.data() as UserSectorProfile) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
};

export const getUserAlerts = async (userId: string): Promise<TenderAlert[]> => {
  const path = `users/${userId}/alerts`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'alerts'));
    const alerts: TenderAlert[] = [];
    snap.forEach((d) => alerts.push({ id: d.id, ...(d.data() as object) } as TenderAlert));
    return alerts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
};

export const markAlertAsRead = async (userId: string, alertId: string): Promise<void> => {
  const path = `users/${userId}/alerts/${alertId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'alerts', alertId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
};
