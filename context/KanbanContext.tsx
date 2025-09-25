import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Task,
  Member,
  ID,
  TaskStatus,
  FilterState,
  Attachment,
  VoiceNote,
  MemberRole,
  BoardConfig,
  Notification,
  NotificationType,
} from '../types';
import * as db from '../services/db';
import { auth } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  TEAM_MEMBERS_SEED,
  TASKS_SEED,
  DB_CONFIG,
  BOARD_CONFIG_ID,
  DEFAULT_COLUMN_NAMES,
} from '../constants';
import { useToast } from '../hooks/useToast';
import { isOverdue } from '../utils/helpers';
// FIX: Imported `doc` from firebase/firestore to be used for listening to config changes.
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db as firestoreDb } from '../services/firebase';

interface NotificationSettings {
  enabled: boolean;
}

// Define the shape of the context value
interface IKanbanContext {
  tasks: Task[];
  members: Member[];
  columnNames: Record<TaskStatus, string>;
  filters: FilterState;
  loading: boolean;
  currentUser: Member | null;
  notifications: Notification[];
  notificationSettings: NotificationSettings;
  isOffline: boolean;
  firestoreError: Error | null;
  addTask: (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'creatorId'>,
    newAttachments: { file: File; id: string }[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]
  ) => Promise<void>;
  updateTask: (
    updatedTask: Task,
    newAttachments: { file: File; id: string }[],
    attachmentsToRemove: Attachment[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[],
    voiceNotesToRemove: VoiceNote[]
  ) => Promise<void>;
  deleteTask: (taskId: ID) => Promise<void>;
  moveTask: (taskId: ID, newStatus: TaskStatus) => Promise<void>;
  archiveTasks: (taskIds: ID[]) => Promise<void>;
  unarchiveTask: (taskId: ID) => Promise<void>;
  getMemberById: (id: ID) => Member | undefined;
  setFilters: (filters: FilterState) => void;
  addMember: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'role'> & {role: MemberRole, password?: string}) => Promise<void>;
  updateMember: (updatedMember: Member, newAvatar?: File) => Promise<void>;
  deleteMember: (memberId: ID) => Promise<void>;
  updateColumnNames: (newNames: Record<TaskStatus, string>) => Promise<void>;
  clearAllTasks: () => Promise<void>;
  resetBoard: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  markNotificationAsRead: (notificationId: ID) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  updateNotificationSettings: (settings: NotificationSettings) => void;
}

// Create the context with a default value of undefined
export const KanbanContext = createContext<IKanbanContext | undefined>(undefined);

// Define the provider component
export const KanbanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({ enabled: true });
  const [columnNames, setColumnNames] = useState<Record<TaskStatus, string>>(DEFAULT_COLUMN_NAMES);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    assigneeIds: [],
    responsibleId: undefined,
    dueDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);
  const { showToast } = useToast();

  const getMemberById = useCallback((id: ID) => members.find(m => m.id === id), [members]);

  const checkAndGenerateNotifications = useCallback(async (user: Member, currentTasks: Task[], currentNotifications: Notification[]) => {
      if (!notificationSettings.enabled) return;
      
      const newNotifications: Notification[] = [];
      const notificationsToDelete: ID[] = [];

      const userTasks = currentTasks.filter(t => t.assigneeIds.includes(user.id));
      const doneTaskIds = new Set(currentTasks.filter(t => t.status === TaskStatus.DONE).map(t => t.id));

      // Clean up notifications for tasks that are now done
      currentNotifications.forEach(n => {
          if (doneTaskIds.has(n.taskId) && (n.type === NotificationType.OVERDUE || n.type === NotificationType.DUE_SOON)) {
              notificationsToDelete.push(n.id);
          }
      });
      
      // Generate new notifications for active tasks
      for (const task of userTasks) {
          if (task.status === TaskStatus.DONE) continue;
          
          const twentyFourHours = 24 * 60 * 60 * 1000;
          const now = Date.now();
          const dueDate = task.dueDate ? new Date(task.dueDate).getTime() : 0;
          const timeUntilDue = dueDate - now;

          // Overdue
          if (isOverdue(task.dueDate)) {
              const alreadyNotified = currentNotifications.some(n => n.taskId === task.id && n.type === NotificationType.OVERDUE && !n.isRead);
              if (!alreadyNotified) {
                  newNotifications.push({
                      id: crypto.randomUUID(),
                      recipientId: user.id,
                      taskId: task.id,
                      taskTitle: task.title,
                      type: NotificationType.OVERDUE,
                      message: `"${task.title}" görevinin son tarihi geçti.`,
                      isRead: false,
                      createdAt: new Date().toISOString(),
                  });
              }
          }
          // Due soon
          else if (timeUntilDue > 0 && timeUntilDue <= twentyFourHours) {
              const alreadyNotified = currentNotifications.some(n => n.taskId === task.id && n.type === NotificationType.DUE_SOON && !n.isRead);
              if (!alreadyNotified) {
                  newNotifications.push({
                      id: crypto.randomUUID(),
                      recipientId: user.id,
                      taskId: task.id,
                      taskTitle: task.title,
                      type: NotificationType.DUE_SOON,
                      message: `"${task.title}" görevinin son tarihi yaklaşıyor.`,
                      isRead: false,
                      createdAt: new Date().toISOString(),
                  });
              }
          }
      }

      if (notificationsToDelete.length > 0) {
        await db.dbDeleteNotifications(notificationsToDelete);
      }

      if (newNotifications.length > 0) {
          for (const n of newNotifications) await db.dbPutNotification(n);
      }
      
  }, [notificationSettings.enabled]);

  // Auth and real-time data listener effect
  useEffect(() => {
    setLoading(true);
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
        setNotificationSettings(JSON.parse(savedSettings));
    }

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            // User is signed in, set up listeners
            const unsubTasks = onSnapshot(collection(firestoreDb, DB_CONFIG.STORES.TASKS), (snapshot) => {
                const updatedTasks = snapshot.docs.map(doc => doc.data() as Task);
                setTasks(updatedTasks.filter(t => !t.isArchived));
            }, (error) => {
                console.error("Firestore 'tasks' listener failed:", error);
                // FIX: Create a new Error object to ensure type compatibility with the state.
                setFirestoreError(new Error(`[${error.code}] ${error.message}`));
                setIsOffline(true);
                setLoading(false);
            });
            const unsubMembers = onSnapshot(collection(firestoreDb, DB_CONFIG.STORES.MEMBERS), 
                (snapshot) => {
                    if (snapshot.metadata.fromCache) {
                        console.warn("Members data from cache. Connection to Firestore might be lost.");
                        setIsOffline(true);
                    } else {
                        setIsOffline(false);
                        if (firestoreError) setFirestoreError(null); // Connection re-established
                    }
                    const updatedMembers = snapshot.docs.map(doc => doc.data() as Member);
                    setMembers(updatedMembers);
                    // Update current user's info if it changes
                    const updatedCurrentUser = updatedMembers.find(m => m.id === firebaseUser.uid);
                    if(updatedCurrentUser) setCurrentUser(updatedCurrentUser);
                },
                (error) => {
                    console.error("Firestore 'members' listener failed:", error);
                    // FIX: Create a new Error object to ensure type compatibility with the state.
                    setFirestoreError(new Error(`[${error.code}] ${error.message}`));
                    setIsOffline(true);
                    setLoading(false);
                }
            );
            const unsubConfig = onSnapshot(doc(firestoreDb, DB_CONFIG.STORES.CONFIG, BOARD_CONFIG_ID), (configDoc) => {
                const config = configDoc.data() as BoardConfig | undefined;
                setColumnNames(config?.columnNames || DEFAULT_COLUMN_NAMES);
            }, (error) => {
                console.error("Firestore 'config' listener failed:", error);
                // FIX: Create a new Error object to ensure type compatibility with the state.
                setFirestoreError(new Error(`[${error.code}] ${error.message}`));
                setIsOffline(true);
                setLoading(false);
            });
            const notificationsQuery = query(collection(firestoreDb, DB_CONFIG.STORES.NOTIFICATIONS), where("recipientId", "==", firebaseUser.uid));
            const unsubNotifications = onSnapshot(notificationsQuery, (snapshot) => {
                const userNotifications = snapshot.docs.map(doc => doc.data() as Notification);
                userNotifications.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setNotifications(userNotifications);
            }, (error) => {
                console.error("Firestore 'notifications' listener failed:", error);
                // FIX: Create a new Error object to ensure type compatibility with the state.
                setFirestoreError(new Error(`[${error.code}] ${error.message}`));
                setIsOffline(true);
                setLoading(false);
            });
            
            try {
                const userProfile = await db.dbGetMember(firebaseUser.uid);
                if (userProfile) {
                    setCurrentUser(userProfile);
                } else {
                    console.error("User is authenticated but no profile found in database!");
                    firebaseSignOut(auth);
                }
                setLoading(false);
            } catch (error: any) {
                console.error("Error fetching user profile:", error);
                // FIX: Create a new Error object to ensure type compatibility with the state.
                setFirestoreError(new Error(`[${error.code}] ${error.message}`));
                setIsOffline(true);
                setLoading(false);
            }

            // Return cleanup function to unsubscribe from listeners when user signs out
            return () => {
                unsubTasks();
                unsubMembers();
                unsubConfig();
                unsubNotifications();
            };
        } else {
            // User is signed out
            setCurrentUser(null);
            setTasks([]);
            setMembers([]);
            setNotifications([]);
            setFirestoreError(null);
            setLoading(false);
        }
    });

    return () => unsubAuth(); // Cleanup auth listener on component unmount
  }, []);

  // Effect for checking and generating notifications when relevant data changes.
  useEffect(() => {
    if (loading || !currentUser) return;

    const check = async () => {
      await checkAndGenerateNotifications(currentUser, tasks, notifications);
    };

    const intervalId = setInterval(check, 60 * 1000); // Check every minute
    check(); // Initial check

    return () => clearInterval(intervalId);
  }, [loading, currentUser, tasks, notifications, checkAndGenerateNotifications]);


  const processNewAttachments = async (newAttachments: { file: File; id: string }[], taskId: string): Promise<Attachment[]> => {
    const processed: Attachment[] = [];
    for (const { file, id } of newAttachments) {
      const path = `attachments/${taskId}/${id}-${file.name}`;
      const url = await db.dbUploadFile(path, file);
      processed.push({
        id,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        url,
        createdAt: new Date().toISOString(),
      });
    }
    return processed;
  };

  const processNewVoiceNotes = async (newVoiceNotes: { blob: Blob; durationMs: number; id: string }[], taskId: string): Promise<VoiceNote[]> => {
    const processed: VoiceNote[] = [];
    for (const { blob, durationMs, id } of newVoiceNotes) {
      const path = `voiceNotes/${taskId}/${id}.webm`;
      const url = await db.dbUploadFile(path, blob);
      processed.push({
        id,
        url,
        durationMs,
        createdAt: new Date().toISOString(),
      });
    }
    return processed;
  };

  const removeFiles = async (attachmentsToRemove: Attachment[], voiceNotesToRemove: VoiceNote[]) => {
    for (const att of attachmentsToRemove) {
        await db.dbDeleteFile(att.url);
    }
    for (const note of voiceNotesToRemove) {
        await db.dbDeleteFile(note.url);
    }
  };

  const addTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'creatorId'>,
    newAttachments: { file: File; id: string }[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    
    const newTaskId = crypto.randomUUID();
    const processedAttachments = await processNewAttachments(newAttachments, newTaskId);
    const processedVoiceNotes = await processNewVoiceNotes(newVoiceNotes, newTaskId);

    const newTask: Task = {
      ...taskData,
      id: newTaskId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: currentUser.id,
      attachments: processedAttachments,
      voiceNotes: processedVoiceNotes,
    };
    
    if (notificationSettings.enabled) {
        for (const assigneeId of newTask.assigneeIds) {
            if (assigneeId !== currentUser.id) {
                 const notification: Notification = {
                    id: crypto.randomUUID(),
                    recipientId: assigneeId,
                    taskId: newTask.id,
                    taskTitle: newTask.title,
                    type: NotificationType.ASSIGNMENT,
                    message: `${currentUser.name} sizi "${newTask.title}" görevine atadı.`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                };
                await db.dbPutNotification(notification);
            }
        }
    }

    await db.dbPutTask(newTask);
    showToast('Görev başarıyla oluşturuldu!', 'success');
  };

  const updateTask = async (
    updatedTask: Task,
    newAttachments: { file: File; id: string }[],
    attachmentsToRemove: Attachment[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[],
    voiceNotesToRemove: VoiceNote[]
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    
    const originalTask = tasks.find(t => t.id === updatedTask.id) ?? await db.dbGetTask(updatedTask.id);
    if (!originalTask) {
        showToast("Güncellenecek görev bulunamadı.", 'error');
        return;
    }

    if (notificationSettings.enabled) {
        const oldAssignees = new Set(originalTask.assigneeIds);
        const newAssignees = updatedTask.assigneeIds.filter(id => !oldAssignees.has(id));
        for (const assigneeId of newAssignees) {
            if (assigneeId !== currentUser.id) { // Don't notify for self-assignment
                 const notification: Notification = {
                    id: crypto.randomUUID(),
                    recipientId: assigneeId,
                    taskId: updatedTask.id,
                    taskTitle: updatedTask.title,
                    type: NotificationType.ASSIGNMENT,
                    message: `${currentUser.name} sizi "${updatedTask.title}" görevine atadı.`,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                };
                await db.dbPutNotification(notification);
            }
        }
    }

    let completedAt = originalTask.completedAt;
    if (updatedTask.status !== originalTask.status) {
        if (updatedTask.status === TaskStatus.DONE) {
            completedAt = new Date().toISOString();
            const notificationsToDelete = notifications
                .filter(n => n.taskId === updatedTask.id && (n.type === NotificationType.DUE_SOON || n.type === NotificationType.OVERDUE))
                .map(n => n.id);
            if (notificationsToDelete.length > 0) {
                await db.dbDeleteNotifications(notificationsToDelete);
            }
        } else if (originalTask.status === TaskStatus.DONE) {
            completedAt = undefined;
        }
    }

    const processedAttachments = await processNewAttachments(newAttachments, updatedTask.id);
    const processedVoiceNotes = await processNewVoiceNotes(newVoiceNotes, updatedTask.id);
    await removeFiles(attachmentsToRemove, voiceNotesToRemove);

    const finalTask = {
      ...updatedTask,
      completedAt,
      attachments: [...updatedTask.attachments, ...processedAttachments],
      voiceNotes: [...updatedTask.voiceNotes, ...processedVoiceNotes],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.id,
    };

    await db.dbPutTask(finalTask);
    showToast('Görev başarıyla güncellendi!', 'success');
  };
  
  const deleteTask = async (taskId: ID) => {
      const taskToDelete = tasks.find(t => t.id === taskId);
      if (!taskToDelete) return;

      // Remove files from storage
      await removeFiles(taskToDelete.attachments, taskToDelete.voiceNotes);

      // Remove task from Firestore
      await db.dbDeleteTask(taskId);
      showToast('Görev silindi.', 'info');
  };

  const moveTask = async (taskId: ID, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && currentUser) {
      let completedAt = task.completedAt;
      if (newStatus === TaskStatus.DONE) {
          completedAt = new Date().toISOString();
          const notificationsToDelete = notifications
              .filter(n => n.taskId === taskId && (n.type === NotificationType.DUE_SOON || n.type === NotificationType.OVERDUE))
              .map(n => n.id);
          if (notificationsToDelete.length > 0) {
              await db.dbDeleteNotifications(notificationsToDelete);
          }
      } else if (task.status === TaskStatus.DONE) {
          completedAt = undefined;
      }
      const updatedTask = { ...task, status: newStatus, updatedAt: new Date().toISOString(), updatedBy: currentUser.id, completedAt };
      await db.dbPutTask(updatedTask);
    }
  };
  
  const archiveTasks = async (taskIds: ID[]) => {
      // FIX: Corrected filtering logic to use `taskIds.includes(t.id)` instead of a non-existent method.
      const tasksToArchive = tasks.filter(t => taskIds.includes(t.id));
      if (tasksToArchive.length === 0) return;

      for(const task of tasksToArchive) {
          const updated = { ...task, isArchived: true, completedAt: task.completedAt || new Date().toISOString() };
          await db.dbPutTask(updated);
      }
      
      showToast(`${tasksToArchive.length} görev arşivlendi.`, 'success');
  };
  
  const unarchiveTask = async (taskId: ID) => {
      const task = await db.dbGetTask(taskId);
      if (!task || !task.isArchived) return;

      const updatedTask = { ...task, isArchived: false };
      await db.dbPutTask(updatedTask);
      showToast('Görev arşive geri alındı.', 'success');
  };
  
  const addMember = async (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'> & { password?: string}) => {
      if (!memberData.password) {
          showToast("Yeni üye için şifre gerekli.", "error");
          return;
      }
      try {
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, memberData.email, memberData.password);
        const newUserId = userCredential.user.uid;

        // 2. Create user profile in Firestore
        const now = new Date().toISOString();
        const newMember: Member = {
            name: memberData.name,
            email: memberData.email,
            role: memberData.role,
            avatarUrl: memberData.avatarUrl,
            id: newUserId,
            createdAt: now,
            updatedAt: now,
        };
        await db.dbPutMember(newMember);
        showToast('Yeni üye eklendi.', 'success');
      } catch (error: any) {
          console.error("Error adding member:", error);
          if (error.code === 'auth/email-already-in-use') {
              showToast("Bu e-posta adresi zaten kullanılıyor.", "error");
          } else {
              showToast("Üye eklenemedi.", "error");
          }
      }
  };

  const updateMember = async (updatedMember: Member, newAvatar?: File) => {
      let finalMember = { ...updatedMember, updatedAt: new Date().toISOString() };
      
      if (newAvatar) {
          if (finalMember.avatarUrl) {
              // Delete old avatar if it exists and it's a firebase storage url
              if (finalMember.avatarUrl.includes('firebasestorage.googleapis.com')) {
                await db.dbDeleteFile(finalMember.avatarUrl);
              }
          }
          const path = `avatars/${finalMember.id}/avatar-${Date.now()}`;
          const downloadUrl = await db.dbUploadFile(path, newAvatar);
          finalMember.avatarUrl = downloadUrl;
      }

      await db.dbPutMember(finalMember);
      showToast('Profil güncellendi.', 'success');
  };
  
  const deleteMember = async (memberId: ID) => {
      // Deleting from Firebase Auth is a sensitive operation and should be done in a backend environment.
      // This implementation will only delete the user from the Firestore 'members' collection.
      await db.dbDeleteMember(memberId);
      showToast('Üye Firestore\'dan silindi. (Not: Firebase Auth kullanıcısı hala mevcut)', 'info');
  };
  
  const updateColumnNames = async (newNames: Record<TaskStatus, string>) => {
      const newConfig: BoardConfig = { id: BOARD_CONFIG_ID, columnNames: newNames };
      await db.dbPutConfig(newConfig);
      showToast('Pano ayarları kaydedildi.', 'success');
  };

  const clearAllTasks = async () => {
      const allTasks = await db.dbGetTasks();
      for(const task of allTasks) {
          await removeFiles(task.attachments, task.voiceNotes);
          await db.dbDeleteTask(task.id);
      }
      showToast('Tüm görevler silindi.', 'warning');
  };
  
  const markNotificationAsRead = async (notificationId: ID) => {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
          const updatedNotification = { ...notification, isRead: true };
          await db.dbPutNotification(updatedNotification);
      }
  };

  const markAllNotificationsAsRead = async () => {
      if (!currentUser) return;
      const unreadNotifications = notifications.filter(n => !n.isRead);
      if(unreadNotifications.length === 0) return;
      
      for(const n of unreadNotifications) {
          const updated = {...n, isRead: true};
          await db.dbPutNotification(updated);
      }
  };
  
  const updateNotificationSettings = (settings: NotificationSettings) => {
      setNotificationSettings(settings);
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
      showToast('Bildirim ayarları güncellendi.', 'success');
  };
  
  const resetBoard = async (showMsg=true) => {
    setLoading(true);
    // Clear existing data
    await db.dbClearStore(DB_CONFIG.STORES.TASKS);
    await db.dbClearStore(DB_CONFIG.STORES.NOTIFICATIONS);
    // Note: Clearing members would require re-creating auth users, which is complex.
    // We will just overwrite/add members from the seed.
    // Clearing storage folders is also complex from the client.
    
    const now = new Date().toISOString();
    const seededMembers: Member[] = [];
    for (const memberSeed of TEAM_MEMBERS_SEED) {
        try {
            // Check if member exists by email to avoid creating duplicate auth users
            let member = members.find(m => m.email === memberSeed.email);
            if (!member) {
              const userCredential = await createUserWithEmailAndPassword(auth, memberSeed.email, memberSeed.password!);
              const newMember: Member = {
                  ...memberSeed,
                  id: userCredential.user.uid,
                  createdAt: now,
                  updatedAt: now,
              };
              await db.dbPutMember(newMember);
              seededMembers.push(newMember);
            } else {
              seededMembers.push(member);
            }
        } catch(e: any) {
            if(e.code === 'auth/email-already-in-use') {
                const existingMember = (await db.dbGetMembers()).find(m => m.email === memberSeed.email);
                if(existingMember) seededMembers.push(existingMember);
            } else console.error("Error seeding member", e);
        }
    }
    
    const seededTasks: Task[] = [];
    for (const taskSeed of TASKS_SEED) {
        const creator = seededMembers[Math.floor(Math.random() * seededMembers.length)];
        const responsible = seededMembers[Math.floor(Math.random() * seededMembers.length)];
        const numAssignees = Math.floor(Math.random() * 3) + 1;
        const assignees = new Set<Member>([responsible]);
        while(assignees.size < numAssignees) {
            assignees.add(seededMembers[Math.floor(Math.random() * seededMembers.length)]);
        }

        const newTask: Task = {
            ...taskSeed,
            id: crypto.randomUUID(),
            creatorId: creator.id,
            responsibleId: responsible.id,
            assigneeIds: Array.from(assignees).map(m => m.id),
            createdAt: now,
            updatedAt: now,
        };
        await db.dbPutTask(newTask);
        seededTasks.push(newTask);
    }

    const boardConfig: BoardConfig = { id: BOARD_CONFIG_ID, columnNames: DEFAULT_COLUMN_NAMES };
    await db.dbPutConfig(boardConfig);
    
    if (showMsg) {
      showToast('Pano başarıyla sıfırlandı!', 'success');
    }
    setLoading(false);
  };

  // Auth
  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast(`Giriş başarılı!`, 'success');
        return true;
    } catch(error: any) {
        console.error("Sign in failed:", error.code);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showToast('E-posta veya şifre yanlış.', 'error');
        } else {
            showToast('Giriş sırasında bir hata oluştu.', 'error');
        }
        return false;
    }
  };

  const signOut = () => {
    firebaseSignOut(auth).then(() => {
        showToast('Başarıyla çıkış yapıldı.', 'info');
    });
  };

  const contextValue: IKanbanContext = {
    tasks,
    members,
    columnNames,
    filters,
    loading,
    currentUser,
    notifications,
    notificationSettings,
    isOffline,
    firestoreError,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    archiveTasks,
    unarchiveTask,
    getMemberById,
    setFilters,
    addMember,
    updateMember,
    deleteMember,
    updateColumnNames,
    clearAllTasks,
    resetBoard,
    signIn,
    signOut,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    updateNotificationSettings,
  };

  return <KanbanContext.Provider value={contextValue}>{children}</KanbanContext.Provider>;
};