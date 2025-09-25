import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { BOARD_CONFIG_ID } from '../constants';

const firebaseConfig = {
  apiKey: "AIzaSyAJOj8RC6xI5VfkFJUNICCEM6cC_soJGY8",
  authDomain: "thf-wflow-app.firebaseapp.com",
  projectId: "thf-wflow-app",
  storageBucket: "thf-wflow-app.firebasestorage.app",
  messagingSenderId: "437767178687",
  appId: "1:437767178687:web:c4321fb8c1b3a908faf90a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Tests the connection to Firestore by attempting to fetch a known document.
 * Logs the outcome to the console.
 */
export const testFirestoreConnection = async () => {
  console.log("Firestore bağlantısı test ediliyor...");
  try {
    // Attempt to get a known document. The board config is a good candidate.
    const configDocRef = doc(db, 'config', BOARD_CONFIG_ID);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists()) {
      console.log("✅ Firestore bağlantısı başarılı! Konfigürasyon belgesi bulundu:", docSnap.data());
    } else {
      console.warn("⚠️ Firestore bağlantısı başarılı ancak 'config' koleksiyonunda varsayılan pano konfigürasyonu bulunamadı. Bu, uygulamanın ilk çalıştırılışı olabilir.");
    }
  } catch (error) {
    console.error("❌ Firestore bağlantısı test edilirken hata oluştu:", error);
  }
};

// Automatically run the test when the module is loaded
testFirestoreConnection();


export default app;