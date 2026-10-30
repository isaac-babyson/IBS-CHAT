// 1) Créez un projet dans Firebase Console.
// 2) Ajoutez une application Web et collez ici ses paramètres.
// 3) Activez Authentication (Phone et Email/Password), Firestore et Storage.
// Ne publiez jamais de clé privée de service account dans cette application.
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "REMPLACER_PAR_VOTRE_API_KEY",
  authDomain: "REMPLACER.firebaseapp.com",
  projectId: "REMPLACER_PAR_VOTRE_PROJECT_ID",
  storageBucket: "REMPLACER.firebasestorage.app",
  messagingSenderId: "REMPLACER",
  appId: "REMPLACER"
};

const configured = !firebaseConfig.apiKey.startsWith("REMPLACER");
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const firebaseReady = configured;
