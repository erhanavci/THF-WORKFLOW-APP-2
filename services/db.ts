import { IDBPCursorWithValue, IDBPDatabase, openDB } from 'idb';
import { Task, Member, Attachment, VoiceNote, BoardConfig, Notification, MemberRole } from '../types';
import { DB_CONFIG, TEAM_MEMBERS_SEED, TASKS_SEED, BOARD_CONFIG_ID, DEFAULT_COLUMN_NAMES } from '../constants';

const { DB_NAME, DB_VERSION, STORES } = DB_CONFIG;

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDb = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.MEMBERS)) {
          db.createObjectStore(STORES.MEMBERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
          db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.VOICE_NOTES)) {
          db.createObjectStore(STORES.VOICE_NOTES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.CONFIG)) {
            db.createObjectStore(STORES.CONFIG, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AVATARS)) {
            db.createObjectStore(STORES.AVATARS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
            db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
        }
        
        // Seed data atomically on database creation
        if (oldVersion === 0) {
            console.log('Database created for the first time. Seeding initial data...');
            const now = new Date().toISOString();
            
            // Seed Members
            const memberStore = tx.objectStore(STORES.MEMBERS);
            const seededMembers: Member[] = TEAM_MEMBERS_SEED.map(memberSeed => ({
                ...memberSeed,
                id: crypto.randomUUID(),
                createdAt: now,
                updatedAt: now,
            }));
            seededMembers.forEach(member => memberStore.add(member));
            console.log(`${seededMembers.length} members seeded.`);

            // Seed Tasks
            const taskStore = tx.objectStore(STORES.TASKS);
            const seededTasks: Task[] = TASKS_SEED.map(taskSeed => {
                const creator = seededMembers[Math.floor(Math.random() * seededMembers.length)];
                const responsible = seededMembers[Math.floor(Math.random() * seededMembers.length)];
                const assignees = new Set<Member>([responsible]);
                while (assignees.size < Math.floor(Math.random() * 3) + 1) {
                    assignees.add(seededMembers[Math.floor(Math.random() * seededMembers.length)]);
                }
                return {
                    ...taskSeed,
                    id: crypto.randomUUID(),
                    creatorId: creator.id,
                    responsibleId: responsible.id,
                    assigneeIds: Array.from(assignees).map(m => m.id),
                    createdAt: now,
                    updatedAt: now,
                };
            });
            seededTasks.forEach(task => taskStore.add(task));
            console.log(`${seededTasks.length} tasks seeded.`);
            
            // Seed Config
            const configStore = tx.objectStore(STORES.CONFIG);
            const boardConfig: BoardConfig = { id: BOARD_CONFIG_ID, columnNames: DEFAULT_COLUMN_NAMES };
            configStore.add(boardConfig);
            console.log('Board config seeded.');
        }
      },
    });
  }
  return dbPromise;
};

// Generic CRUD operations
const getAll = async <T,>(storeName: string): Promise<T[]> => {
  const db = await getDb();
  return db.getAll(storeName);
};

const get = async <T,>(storeName: string, id: string): Promise<T | undefined> => {
    const db = await getDb();
    return db.get(storeName, id);
};

const put = async <T,>(storeName: string, item: T): Promise<void> => {
  const db = await getDb();
  await db.put(storeName, item);
};

const remove = async (storeName: string, id: string): Promise<void> => {
    const db = await getDb();
    await db.delete(storeName, id);
};

export const dbClearStore = async (storeName: string): Promise<void> => {
    const db = await getDb();
    await db.clear(storeName);
};


// Task specific operations
export const dbGetTasks = () => getAll<Task>(STORES.TASKS);
export const dbGetTask = (id: string) => get<Task>(STORES.TASKS, id);
export const dbPutTask = (task: Task) => put(STORES.TASKS, task);
export const dbDeleteTask = (id: string) => remove(STORES.TASKS, id);
export const dbClearTasks = () => dbClearStore(STORES.TASKS);

// Notification specific operations
export const dbGetNotifications = () => getAll<Notification>(STORES.NOTIFICATIONS);
export const dbPutNotification = (notification: Notification) => put(STORES.NOTIFICATIONS, notification);
export const dbDeleteNotifications = async (ids: string[]): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(STORES.NOTIFICATIONS, 'readwrite');
  await Promise.all(ids.map(id => tx.store.delete(id)));
  await tx.done;
};
export const dbClearNotifications = () => dbClearStore(STORES.NOTIFICATIONS);


// Member specific operations
export const dbGetMembers = () => getAll<Member>(STORES.MEMBERS);
export const dbPutMember = (member: Member) => put<Member>(STORES.MEMBERS, member);
export const dbDeleteMember = (id: string) => remove(STORES.MEMBERS, id);
export const dbClearMembers = () => dbClearStore(STORES.MEMBERS);

// Blob storage for attachments and voice notes
export const dbPutBlob = (storeName: string, id: string, blob: Blob) => {
    return put(storeName, { id, blob });
};

export const dbGetBlob = async (storeName: string, id: string): Promise<Blob | undefined> => {
    const result = await get<{id: string, blob: Blob}>(storeName, id);
    return result?.blob;
}

export const dbDeleteBlob = (storeName: string, id: string) => remove(storeName, id);

// Config specific operations
export const dbGetConfig = (id: string) => get<BoardConfig>(STORES.CONFIG, id);
export const dbPutConfig = (config: BoardConfig) => put<BoardConfig>(STORES.CONFIG, config);