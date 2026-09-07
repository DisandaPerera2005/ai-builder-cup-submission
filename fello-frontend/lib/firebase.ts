import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAkBIkfQecI2sAPEAv42X8q48wos1rRM7A",
  authDomain: "fello-pt.firebaseapp.com",
  projectId: "fello-pt",
  storageBucket: "fello-pt.firebasestorage.app",
  messagingSenderId: "181789735145",
  appId: "1:181789735145:web:5123606be8ead5b5d65878",
  measurementId: "G-Q9EFT791NL"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let analytics;
if (app.name && typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
