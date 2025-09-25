// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// IMPORTANT: Replace this with your own Firebase project's configuration.
const firebaseConfig = {
  apiKey: "AIzaSyAJOj8RC6xI5VfkFJUNICCEM6cC_soJGY8",
  authDomain: "thf-wflow-app.firebaseapp.com",
  projectId: "thf-wflow-app",
  storageBucket: "thf-wflow-app.firebasestorage.app",
  messagingSenderId: "437767178687",
  appId: "1:437767178687:web:c4321fb8c1b3a908faf90a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
