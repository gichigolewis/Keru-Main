import { getApps, initializeApp } from "@firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from "@firebase/auth";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
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
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
};

export function requireFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error("Firebase Authentication is not configured for this site.");
  }
  return firebaseAuth;
}

async function requireFirebaseStorage() {
  if (!firebaseApp) {
    throw new Error("Firebase is not configured for this site.");
  }
  if (!firebaseConfig.storageBucket) {
    throw new Error("Firebase Storage is not configured. Set VITE_FIREBASE_STORAGE_BUCKET.");
  }
  const storageSdk = await import("@firebase/storage");
  return {
    storage: storageSdk.getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`),
    ...storageSdk,
  };
}

const sermonAudioTypes = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);
const maxSermonAudioBytes = 100 * 1024 * 1024;

export async function uploadChurchAudio(file, onProgress) {
  const user = requireFirebaseAuth().currentUser;
  if (!user) throw new Error("Please sign in as an administrator to upload audio.");
  if (!sermonAudioTypes.has(file.type)) {
    throw new Error("Choose an MP3, M4A, AAC, OGG, WAV, or WebM audio file.");
  }
  if (!file.size || file.size > maxSermonAudioBytes) {
    throw new Error("Audio files must be no larger than 100 MB.");
  }

  const filename = file.name.replace(/[^\w.-]+/g, "-").slice(-120) || "audio";
  const storagePath = `sermon-audio/${user.uid}/${crypto.randomUUID()}-${filename}`;
  const storageSdk = await requireFirebaseStorage();
  const upload = storageSdk.uploadBytesResumable(
    storageSdk.ref(storageSdk.storage, storagePath),
    file,
    { contentType: file.type },
  );

  return new Promise((resolve, reject) => {
    upload.on(
      "state_changed",
      (snapshot) => {
        onProgress?.(
          snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0,
        );
      },
      reject,
      async () => {
        try {
          resolve({
            audioUrl: await storageSdk.getDownloadURL(upload.snapshot.ref),
            audioStoragePath: storagePath,
            audioMimeType: file.type,
          });
        } catch (error) {
          try {
            await storageSdk.deleteObject(upload.snapshot.ref);
          } catch (cleanupError) {
            reject(new Error(`${error.message || "Could not get the audio download URL."} Firebase cleanup also failed: ${cleanupError.message || "remove the unused audio file from Storage."}`));
            return;
          }
          reject(error);
        }
      },
    );
  });
}

export async function deleteChurchAudio(storagePath) {
  if (!storagePath?.startsWith("sermon-audio/")) {
    throw new Error("Invalid sermon audio storage path.");
  }
  const storageSdk = await requireFirebaseStorage();
  await storageSdk.deleteObject(storageSdk.ref(storageSdk.storage, storagePath));
}

export async function getFirebaseAuthHeaders(user, headers = {}) {
  if (!user) throw new Error("Please sign in again to continue.");
  const token = await user.getIdToken();
  return { ...headers, Authorization: `Bearer ${token}` };
}
