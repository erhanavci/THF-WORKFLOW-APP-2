import { db, storage } from './firebase';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    deleteDoc,
    writeBatch,
    query
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Task, Member, BoardConfig, Notification } from '../types';
import { DB_CONFIG, BOARD_CONFIG_ID } from '../constants';

const { STORES } = DB_CONFIG;

// Collection References
const tasksCollection = collection(db, STORES.TASKS);
const membersCollection = collection(db, STORES.MEMBERS);
const configCollection = collection(db, STORES.CONFIG);
const notificationsCollection = collection(db, STORES.NOTIFICATIONS);

// Generic operations
const getAll = async <T>(colRef: any): Promise<T[]> => {
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => doc.data() as T);
};

const get = async <T>(colRef: any, id: string): Promise<T | undefined> => {
    const docRef = doc(colRef, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as T : undefined;
};

const put = async <T extends { id: string }>(colRef: any, item: T): Promise<void> => {
    await setDoc(doc(colRef, item.id), item);
};

const remove = async (colRef: any, id: string): Promise<void> => {
    await deleteDoc(doc(colRef, id));
};

// Task specific operations
export const dbGetTasks = () => getAll<Task>(tasksCollection);
export const dbGetTask = (id: string) => get<Task>(tasksCollection, id);
export const dbPutTask = (task: Task) => put(tasksCollection, task);
export const dbDeleteTask = (id: string) => remove(tasksCollection, id);

// Notification specific operations
export const dbGetNotifications = () => getAll<Notification>(notificationsCollection);
export const dbPutNotification = (notification: Notification) => put(notificationsCollection, notification);
export const dbDeleteNotifications = async (ids: string[]): Promise<void> => {
  const batch = writeBatch(db);
  ids.forEach(id => {
    const docRef = doc(notificationsCollection, id);
    batch.delete(docRef);
  });
  await batch.commit();
};
export const dbClearNotifications = async (): Promise<void> => {
    const q = query(notificationsCollection);
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}


// Member specific operations
export const dbGetMembers = () => getAll<Member>(membersCollection);
export const dbGetMember = (id: string) => get<Member>(membersCollection, id);
export const dbPutMember = (member: Member) => put(membersCollection, member);
export const dbDeleteMember = (id: string) => remove(membersCollection, id);

// File/Blob storage using Firebase Storage
export const dbUploadFile = async (path: string, file: Blob): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const dbDeleteFile = async (fileUrl: string): Promise<void> => {
    try {
        const storageRef = ref(storage, fileUrl);
        await deleteObject(storageRef);
    } catch (error: any) {
        // It's okay if the file doesn't exist (e.g., already deleted)
        if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting file from storage:", error);
            // Optionally re-throw if you want to handle it further up
            // throw error;
        }
    }
};

// Config specific operations
export const dbGetConfig = (id: string) => get<BoardConfig>(configCollection, id);
export const dbPutConfig = (config: BoardConfig) => put<BoardConfig>(configCollection, config);


// --- Bulk Operations for Reset ---
export const dbClearStore = async (storeName: string): Promise<void> => {
    const colRef = collection(db, storeName);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};
