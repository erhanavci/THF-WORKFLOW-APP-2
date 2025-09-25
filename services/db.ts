import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, writeBatch, query, where, documentId } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { Task, Member, BoardConfig, Notification } from '../types';

// Collection names
const TASKS_COLLECTION = 'tasks';
const MEMBERS_COLLECTION = 'users'; // Using 'users' as a more standard collection name for members
const CONFIG_COLLECTION = 'config';
const NOTIFICATIONS_COLLECTION = 'notifications';

// Generic CRUD operations
const getAll = async <T,>(collectionName: string): Promise<T[]> => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

const get = async <T,>(collectionName: string, id: string): Promise<T | undefined> => {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as T : undefined;
};

const put = async <T extends {id: string}>(collectionName: string, item: T): Promise<void> => {
  const docRef = doc(db, collectionName, item.id);
  await setDoc(docRef, item);
};

const remove = async (collectionName: string, id: string): Promise<void> => {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
};

// Task specific operations
export const dbGetTasks = () => getAll<Task>(TASKS_COLLECTION);
export const dbGetTask = (id: string) => get<Task>(TASKS_COLLECTION, id);
export const dbPutTask = (task: Task) => put(TASKS_COLLECTION, task);
export const dbDeleteTask = (id: string) => remove(TASKS_COLLECTION, id);

// Notification specific operations
export const dbGetNotificationsForUser = async (userId: string): Promise<Notification[]> => {
  const q = query(collection(db, NOTIFICATIONS_COLLECTION), where("recipientId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
}
export const dbPutNotification = (notification: Notification) => put(NOTIFICATIONS_COLLECTION, notification);
export const dbDeleteNotifications = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach(id => {
        batch.delete(doc(db, NOTIFICATIONS_COLLECTION, id));
    });
    await batch.commit();
};
export const dbGetNotificationsByTaskId = async (taskId: string): Promise<Notification[]> => {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where("taskId", "==", taskId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
}


// Member specific operations
export const dbGetMembers = () => getAll<Member>(MEMBERS_COLLECTION);
export const dbGetMember = (id: string) => get<Member>(MEMBERS_COLLECTION, id);
export const dbPutMember = (member: Member) => put<Member>(MEMBERS_COLLECTION, member);
export const dbDeleteMember = (id: string) => remove(MEMBERS_COLLECTION, id);
export const dbGetMemberByEmail = async (email: string): Promise<Member | undefined> => {
    const q = query(collection(db, MEMBERS_COLLECTION), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return undefined;
    }
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Member;
};


// File storage for attachments, voice notes, and avatars
export const dbUploadFile = async (path: string, file: Blob): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const dbDeleteFile = async (path: string): Promise<void> => {
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
    } catch (error: any) {
        // It's okay if the file doesn't exist (e.g., already deleted).
        if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting file from storage:", error);
            throw error;
        }
    }
};


// Config specific operations
export const dbGetConfig = (id: string) => get<BoardConfig>(CONFIG_COLLECTION, id);
export const dbPutConfig = (config: BoardConfig) => put<BoardConfig>(CONFIG_COLLECTION, config);