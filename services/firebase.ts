import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
