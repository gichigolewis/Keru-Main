import { getApps, initializeApp } from "@firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from "@firebase/auth";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
].every(Boolean);

export const firebaseApp = firebaseConfigured
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

export {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
};

export function requireFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error("Firebase Authentication is not configured for this site.");
  }
  return firebaseAuth;
}

export async function getFirebaseAuthHeaders(user, headers = {}) {
  if (!user) throw new Error("Please sign in again to continue.");
  const token = await user.getIdToken();
  return { ...headers, Authorization: `Bearer ${token}` };
}
