import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Task, Member, ID, TaskStatus, FilterState, Attachment, VoiceNote, MemberRole, BoardConfig, Notification, NotificationType,
} from '../types';
import { auth, db, storage } from '../services/firebase';
import {
  onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, onSnapshot, writeBatch, query, where, Timestamp, setDoc, deleteDoc, updateDoc, addDoc, orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '../hooks/useToast';
import { isOverdue } from '../utils/helpers';
import { BOARD_CONFIG_ID, DEFAULT_COLUMN_NAMES } from '../constants';


interface NotificationSettings {
  enabled: boolean;
}

interface IKanbanContext {
  tasks: Task[];
  members: Member[];
  columnNames: Record<TaskStatus, string>;
  filters: FilterState;
  loading: boolean;
  currentUser: Member | null;
  notifications: Notification[];
  notificationSettings: NotificationSettings;
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
  addMember: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'password'>) => Promise<void>;
  updateMember: (updatedMember: Member, newAvatar?: File) => Promise<void>;
  deleteMember: (memberId: ID) => Promise<void>;
  updateColumnNames: (newNames: Record<TaskStatus, string>) => Promise<void>;
  clearAllTasks: () => Promise<void>;
  resetBoard: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  markNotificationAsRead: (notificationId: ID) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  updateNotificationSettings: (settings: NotificationSettings) => void;
}

export const KanbanContext = createContext<IKanbanContext | undefined>(undefined);

export const KanbanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({ enabled: true });
  const [columnNames, setColumnNames] = useState<Record<TaskStatus, string>>(DEFAULT_COLUMN_NAMES);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '', assigneeIds: [], responsibleId: undefined, dueDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const { showToast } = useToast();

  const getMemberById = useCallback((id: ID) => members.find(m => m.id === id), [members]);
  
  const checkAndGenerateNotifications = useCallback(async (user: Member, currentTasks: Task[], currentNotifications: Notification[]) => {
      if (!notificationSettings.enabled) return;
      
      const newNotifications: Omit<Notification, 'id'>[] = [];
      const batch = writeBatch(db);

      const userTasks = currentTasks.filter(t => t.assigneeIds.includes(user.id));
      const doneTaskIds = new Set(currentTasks.filter(t => t.status === TaskStatus.DONE).map(t => t.id));

      currentNotifications.forEach(n => {
          if (doneTaskIds.has(n.taskId) && (n.type === NotificationType.OVERDUE || n.type === NotificationType.DUE_SOON)) {
              batch.delete(doc(db, "notifications", n.id));
          }
      });
      
      for (const task of userTasks) {
          if (task.status === TaskStatus.DONE) continue;
          
          const twentyFourHours = 24 * 60 * 60 * 1000;
          const now = Date.now();
          const dueDate = task.dueDate ? new Date(task.dueDate).getTime() : 0;
          const timeUntilDue = dueDate - now;

          if (isOverdue(task.dueDate)) {
              const alreadyNotified = currentNotifications.some(n => n.taskId === task.id && n.type === NotificationType.OVERDUE && !n.isRead);
              if (!alreadyNotified) {
                  newNotifications.push({
                      recipientId: user.id, taskId: task.id, taskTitle: task.title, type: NotificationType.OVERDUE,
                      message: `"${task.title}" görevinin son tarihi geçti.`, isRead: false, createdAt: new Date().toISOString(),
                  });
              }
          }
          else if (timeUntilDue > 0 && timeUntilDue <= twentyFourHours) {
              const alreadyNotified = currentNotifications.some(n => n.taskId === task.id && n.type === NotificationType.DUE_SOON && !n.isRead);
              if (!alreadyNotified) {
                   newNotifications.push({
                      recipientId: user.id, taskId: task.id, taskTitle: task.title, type: NotificationType.DUE_SOON,
                      message: `"${task.title}" görevinin son tarihi yaklaşıyor.`, isRead: false, createdAt: new Date().toISOString(),
                  });
              }
          }
      }

      if (newNotifications.length > 0) {
          newNotifications.forEach(n => {
              const newNotifRef = doc(collection(db, "notifications"));
              batch.set(newNotifRef, n);
          });
      }
      
      await batch.commit();

  }, [notificationSettings.enabled]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const memberDoc = await getDoc(doc(db, 'members', user.uid));
        if (memberDoc.exists()) {
          setCurrentUser({ id: memberDoc.id, ...memberDoc.data() } as Member);
        } else {
          // This case might happen if the user exists in Auth but not in Firestore.
          // For a robust app, you might want to create the member doc here or sign them out.
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);
  
  useEffect(() => {
    if (!currentUser) {
        setTasks([]);
        setMembers([]);
        setNotifications([]);
        return;
    }

    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), where('isArchived', '!=', true)), (snapshot) => {
        const activeTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(activeTasks);
    });

    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
        const allMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
        setMembers(allMembers);
    });
    
    const unsubNotifications = onSnapshot(
        query(collection(db, 'notifications'), where('recipientId', '==', currentUser.id), orderBy('createdAt', 'desc')),
        (snapshot) => {
            const userNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(userNotifications);
        }
    );

    const loadConfig = async () => {
        const configDoc = await getDoc(doc(db, 'config', BOARD_CONFIG_ID));
        if (configDoc.exists()) {
            setColumnNames(configDoc.data().columnNames);
        }
    };
    loadConfig();

    return () => {
        unsubTasks();
        unsubMembers();
        unsubNotifications();
    };
  }, [currentUser]);

   useEffect(() => {
    if (loading || !currentUser) return;
    checkAndGenerateNotifications(currentUser, tasks, notifications);
  }, [loading, currentUser, tasks, notifications, checkAndGenerateNotifications]);


  const uploadFile = async (filePath: string, file: File | Blob): Promise<string> => {
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const processNewAttachments = async (taskId: string, newAttachments: { file: File; id: string }[]): Promise<Attachment[]> => {
    const processed: Attachment[] = [];
    for (const { file, id } of newAttachments) {
      const url = await uploadFile(`attachments/${taskId}/${id}-${file.name}`, file);
      processed.push({
        id, fileName: file.name, mimeType: file.type, sizeBytes: file.size, url, createdAt: new Date().toISOString(),
      });
    }
    return processed;
  };

  const processNewVoiceNotes = async (taskId: string, newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]): Promise<VoiceNote[]> => {
    const processed: VoiceNote[] = [];
    for (const { blob, durationMs, id } of newVoiceNotes) {
      const url = await uploadFile(`voiceNotes/${taskId}/${id}.webm`, blob);
      processed.push({ id, url, durationMs, createdAt: new Date().toISOString() });
    }
    return processed;
  };

  const removeFiles = async (attachmentsToRemove: Attachment[], voiceNotesToRemove: VoiceNote[]) => {
    const promises = [];
    for (const att of attachmentsToRemove) {
        if(att.url) promises.push(deleteObject(ref(storage, att.url)));
    }
    for (const note of voiceNotesToRemove) {
        if(note.url) promises.push(deleteObject(ref(storage, note.url)));
    }
    await Promise.all(promises).catch(err => console.error("Error deleting files from storage:", err));
  };

  const addTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'creatorId'>,
    newAttachments: { file: File; id: string }[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    
    const newTaskRef = doc(collection(db, 'tasks'));
    const taskId = newTaskRef.id;

    const processedAttachments = await processNewAttachments(taskId, newAttachments);
    const processedVoiceNotes = await processNewVoiceNotes(taskId, newVoiceNotes);

    const newTask: Omit<Task, 'id'> = {
      ...taskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: currentUser.id,
      attachments: processedAttachments,
      voiceNotes: processedVoiceNotes,
      isArchived: false,
    };
    
    await setDoc(newTaskRef, newTask);

    if (notificationSettings.enabled) {
        const batch = writeBatch(db);
        for (const assigneeId of newTask.assigneeIds) {
            if (assigneeId !== currentUser.id) {
                 const notification: Omit<Notification, 'id'> = {
                    recipientId: assigneeId, taskId: taskId, taskTitle: newTask.title, type: NotificationType.ASSIGNMENT,
                    message: `${currentUser.name} sizi "${newTask.title}" görevine atadı.`,
                    isRead: false, createdAt: new Date().toISOString(),
                };
                batch.set(doc(collection(db, "notifications")), notification);
            }
        }
        await batch.commit();
    }
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
    
    const originalTask = tasks.find(t => t.id === updatedTask.id);
    if (!originalTask) {
        showToast("Güncellenecek görev bulunamadı.", 'error');
        return;
    }

    const taskRef = doc(db, 'tasks', updatedTask.id);
    const batch = writeBatch(db);

    if (notificationSettings.enabled) {
        const oldAssignees = new Set(originalTask.assigneeIds);
        const newAssignees = updatedTask.assigneeIds.filter(id => !oldAssignees.has(id));
        for (const assigneeId of newAssignees) {
            if (assigneeId !== currentUser.id) {
                 const notification: Omit<Notification, 'id'> = {
                    recipientId: assigneeId, taskId: updatedTask.id, taskTitle: updatedTask.title, type: NotificationType.ASSIGNMENT,
                    message: `${currentUser.name} sizi "${updatedTask.title}" görevine atadı.`,
                    isRead: false, createdAt: new Date().toISOString(),
                };
                batch.set(doc(collection(db, "notifications")), notification);
            }
        }
    }

    let completedAt = originalTask.completedAt;
    if (updatedTask.status !== originalTask.status) {
        if (updatedTask.status === TaskStatus.DONE) {
            completedAt = new Date().toISOString();
            const q = query(collection(db, "notifications"), where("taskId", "==", updatedTask.id));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((docSnap) => {
                const notif = docSnap.data() as Notification;
                if(notif.type === NotificationType.DUE_SOON || notif.type === NotificationType.OVERDUE) {
                    batch.delete(docSnap.ref);
                }
            });
        } else if (originalTask.status === TaskStatus.DONE) {
            completedAt = undefined;
        }
    }

    await removeFiles(attachmentsToRemove, voiceNotesToRemove);
    const processedAttachments = await processNewAttachments(updatedTask.id, newAttachments);
    const processedVoiceNotes = await processNewVoiceNotes(updatedTask.id, newVoiceNotes);

    const finalTaskData = {
      ...updatedTask,
      completedAt,
      attachments: [...updatedTask.attachments, ...processedAttachments],
      voiceNotes: [...updatedTask.voiceNotes, ...processedVoiceNotes],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.id,
    };
    
    delete (finalTaskData as any).id; // Do not write id inside the document
    batch.update(taskRef, finalTaskData);
    
    await batch.commit();

    showToast('Görev başarıyla güncellendi!', 'success');
  };
  
  const deleteTask = async (taskId: ID) => {
      const taskToDelete = tasks.find(t => t.id === taskId);
      if (!taskToDelete) return;

      await removeFiles(taskToDelete.attachments, taskToDelete.voiceNotes);
      await deleteDoc(doc(db, "tasks", taskId));

      showToast('Görev silindi.', 'info');
  };

  const moveTask = async (taskId: ID, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && currentUser) {
      let completedAt = task.completedAt;
      if (newStatus === TaskStatus.DONE) {
          completedAt = new Date().toISOString();
      } else if (task.status === TaskStatus.DONE) {
          completedAt = undefined;
      }
      const updateData = { status: newStatus, updatedAt: new Date().toISOString(), updatedBy: currentUser.id, completedAt };
      await updateDoc(doc(db, "tasks", taskId), updateData);

      if(newStatus === TaskStatus.DONE) {
          const q = query(collection(db, "notifications"), where("taskId", "==", taskId));
          const querySnapshot = await getDocs(q);
          const batch = writeBatch(db);
          querySnapshot.forEach((docSnap) => {
              const notif = docSnap.data() as Notification;
              if(notif.type === NotificationType.DUE_SOON || notif.type === NotificationType.OVERDUE) {
                  batch.delete(docSnap.ref);
              }
          });
          await batch.commit();
      }
    }
  };
  
  const archiveTasks = async (taskIds: ID[]) => {
      const batch = writeBatch(db);
      taskIds.forEach(id => {
          const taskRef = doc(db, "tasks", id);
          batch.update(taskRef, { isArchived: true, completedAt: new Date().toISOString() });
      });
      await batch.commit();
      showToast(`${taskIds.length} görev arşivlendi.`, 'success');
  };
  
  const unarchiveTask = async (taskId: ID) => {
      await updateDoc(doc(db, "tasks", taskId), { isArchived: false });
      showToast('Görev arşive geri alındı.', 'success');
  };
  
  const addMember = async (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'| 'password'>) => {
      // This function is for admin panel. Auth user creation should happen in signUp.
      // This can create a member doc but they won't be able to log in without an Auth account.
      // For this app's purpose, we'll assume admins add users via signUp.
      // This function can be used to add member data if auth is handled separately.
      showToast('Lütfen üyeleri kayıt sayfasından ekleyin.', 'info');
  };

  const updateMember = async (updatedMember: Member, newAvatar?: File) => {
      let finalMember = { ...updatedMember, updatedAt: new Date().toISOString() };
      
      if (newAvatar) {
          const url = await uploadFile(`avatars/${finalMember.id}`, newAvatar);
          finalMember.avatarUrl = url;
      }

      const memberRef = doc(db, "members", finalMember.id);
      const dataToUpdate = { ...finalMember };
      delete (dataToUpdate as any).id;

      await updateDoc(memberRef, dataToUpdate);

      showToast('Profil güncellendi.', 'success');
  };
  
  const deleteMember = async (memberId: ID) => {
      // Deleting a user from Firestore only removes their data from the application's database.
      // It DOES NOT prevent them from signing in, as their account still exists in Firebase Authentication.
      // For a production application, a Cloud Function would be required to listen for this
      // Firestore document deletion and then delete the corresponding user from Firebase Auth.
      await deleteDoc(doc(db, "members", memberId));
      showToast('Üye silindi. (Giriş engellenmedi)', 'info');
  };
  
  const updateColumnNames = async (newNames: Record<TaskStatus, string>) => {
      const newConfig: BoardConfig = { id: BOARD_CONFIG_ID, columnNames: newNames };
      await setDoc(doc(db, "config", BOARD_CONFIG_ID), newConfig);
      showToast('Pano ayarları kaydedildi.', 'success');
  };

  const clearAllTasks = async () => {
      const q = query(collection(db, "tasks"));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      // Note: This does not delete associated files in storage. A cloud function is needed for that.
      showToast('Tüm görevler silindi.', 'warning');
  };
  
  const markNotificationAsRead = async (notificationId: ID) => {
      await updateDoc(doc(db, "notifications", notificationId), { isRead: true });
  };

  const markAllNotificationsAsRead = async () => {
      if (!currentUser) return;
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      if(unreadIds.length === 0) return;
      
      const batch = writeBatch(db);
      unreadIds.forEach(id => {
          batch.update(doc(db, "notifications", id), { isRead: true });
      });
      await batch.commit();
  };
  
  const updateNotificationSettings = (settings: NotificationSettings) => {
      setNotificationSettings(settings);
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
      showToast('Bildirim ayarları güncellendi.', 'success');
  };
  
  const resetBoard = async (showMsg=true) => {
    showToast('Bu işlevsellik Firebase ile devre dışı bırakılmıştır.', 'info');
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast(`Başarıyla giriş yapıldı!`, 'success');
      return true;
    } catch (error: any) {
      console.error("Sign in error:", error);
      showToast(error.code === 'auth/invalid-credential' ? 'E-posta veya şifre yanlış.' : 'Giriş yapılamadı.', 'error');
      return false;
    }
  };
  
  const signUp = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const now = new Date().toISOString();
        
        const newMember: Omit<Member, 'id'> = {
            name,
            email,
            role: MemberRole.MEMBER, // Default role
            avatarUrl: `https://i.pravatar.cc/150?u=${user.uid}`,
            createdAt: now,
            updatedAt: now,
        };
        
        await setDoc(doc(db, 'members', user.uid), newMember);
        showToast(`Hesap oluşturuldu, hoş geldin ${name}!`, 'success');
        return true;
    } catch (error: any) {
        console.error("Sign up error:", error);
        showToast(error.code === 'auth/email-already-in-use' ? 'Bu e-posta zaten kullanımda.' : 'Kayıt başarısız.', 'error');
        return false;
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    showToast('Başarıyla çıkış yapıldı.', 'info');
  };

  const contextValue: IKanbanContext = {
    tasks, members, columnNames, filters, loading, currentUser, notifications, notificationSettings,
    addTask, updateTask, deleteTask, moveTask, archiveTasks, unarchiveTask, getMemberById,
    setFilters, addMember, updateMember, deleteMember, updateColumnNames, clearAllTasks,
    resetBoard, signIn, signUp, signOut, markNotificationAsRead, markAllNotificationsAsRead, updateNotificationSettings,
  };

  return <KanbanContext.Provider value={contextValue}>{children}</KanbanContext.Provider>;
};