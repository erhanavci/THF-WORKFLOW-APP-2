import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Task, Member, ID, TaskStatus, FilterState, Attachment, VoiceNote,
  MemberRole, BoardConfig, Notification, NotificationType,
} from '../types';
import * as firestoreService from '../services/db';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, User } from 'firebase/auth';
// FIX: Import 'doc' to get a reference to a specific document.
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BOARD_CONFIG_ID, DEFAULT_COLUMN_NAMES } from '../constants';
import { useToast } from '../hooks/useToast';
import { isOverdue } from '../utils/helpers';

interface NotificationSettings {
  enabled: boolean;
}

interface IKanbanContext {
  tasks: Task[];
  members: Member[];
  columnNames: Record<TaskStatus, string>;
  filters: FilterState;
  loading: boolean;
  authLoading: boolean;
  currentUser: Member | null;
  notifications: Notification[];
  notificationSettings: NotificationSettings;
  addTask: (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'creatorId' | 'attachments' | 'voiceNotes'>,
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
  addMember: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'password'>, password: string) => Promise<void>;
  updateMember: (updatedMember: Member, newAvatar?: File) => Promise<void>;
  deleteMember: (memberId: ID) => Promise<void>;
  updateColumnNames: (newNames: Record<TaskStatus, string>) => Promise<void>;
  resetBoard: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
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
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const { showToast } = useToast();

  const getMemberById = useCallback((id: ID) => members.find(m => m.id === id), [members]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      setAuthLoading(true);
      if (user) {
        const userProfile = await firestoreService.dbGetMemberByEmail(user.email!);
        if (userProfile) {
          setCurrentUser(userProfile);
        } else {
          // This case might happen if the user exists in Auth but not in Firestore 'users' collection.
          // For this app's logic, we sign them out.
          await firebaseSignOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time data listeners
  useEffect(() => {
    if (!currentUser) {
      // Clear data when user signs out
      setTasks([]);
      setMembers([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(allTasks.filter(t => !t.isArchived));
      setLoading(false);
    });

    const unsubMembers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allMembers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Member));
      setMembers(allMembers);
    });

    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
      const allNotifications = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
      const userNotifications = allNotifications
        .filter(n => n.recipientId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(userNotifications);
    });
    
    const unsubConfig = onSnapshot(doc(db, 'config', BOARD_CONFIG_ID), (doc) => {
        if(doc.exists()){
            const boardConfig = doc.data() as BoardConfig;
            setColumnNames(boardConfig.columnNames);
        }
    });

    return () => {
      unsubTasks();
      unsubMembers();
      unsubNotifications();
      unsubConfig();
    };
  }, [currentUser]);

  const processFiles = async (
    files: { file: File | Blob, id: string }[],
    pathPrefix: string
  ): Promise<{ url: string, id: string, name: string, type: string, size: number }[]> => {
    const processed = [];
    for (const { file, id } of files) {
      const filePath = `${pathPrefix}/${id}_${(file as File).name || 'voicenote.webm'}`;
      const downloadURL = await firestoreService.dbUploadFile(filePath, file);
      processed.push({
        url: downloadURL,
        id,
        name: (file as File).name,
        type: file.type,
        size: file.size,
      });
    }
    return processed;
  };

  const addTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'creatorId' | 'attachments' | 'voiceNotes'>,
    newAttachments: { file: File; id: string }[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    
    const taskId = crypto.randomUUID();

    const processedAttachments = await processFiles(newAttachments, `attachments/${taskId}`);
    const finalAttachments: Attachment[] = processedAttachments.map(p => ({
        id: p.id,
        fileName: p.name,
        mimeType: p.type,
        sizeBytes: p.size,
        blobKey: p.url, // Store URL in blobKey for simplicity
        createdAt: new Date().toISOString(),
    }));

    const processedVoiceNotes = await processFiles(newVoiceNotes.map(vn => ({file: vn.blob, id: vn.id})), `voice_notes/${taskId}`);
    const finalVoiceNotes: VoiceNote[] = newVoiceNotes.map((vn, index) => ({
        id: vn.id,
        durationMs: vn.durationMs,
        blobKey: processedVoiceNotes[index].url,
        createdAt: new Date().toISOString(),
    }));

    const newTask: Task = {
      ...taskData,
      id: taskId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: currentUser.id,
      attachments: finalAttachments,
      voiceNotes: finalVoiceNotes,
      notes: [],
    };
    
    await firestoreService.dbPutTask(newTask);

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
                await firestoreService.dbPutNotification(notification);
            }
        }
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

    // Process file removals from Storage
    for (const att of attachmentsToRemove) {
        await firestoreService.dbDeleteFile(att.blobKey);
    }
    for (const note of voiceNotesToRemove) {
        await firestoreService.dbDeleteFile(note.blobKey);
    }

    // Process file additions to Storage
    const processedAttachments = await processFiles(newAttachments, `attachments/${updatedTask.id}`);
    const finalNewAttachments: Attachment[] = processedAttachments.map(p => ({
        id: p.id, fileName: p.name, mimeType: p.type, sizeBytes: p.size,
        blobKey: p.url, createdAt: new Date().toISOString(),
    }));

    const processedVoiceNotes = await processFiles(newVoiceNotes.map(vn => ({file: vn.blob, id: vn.id})), `voice_notes/${updatedTask.id}`);
    const finalNewVoiceNotes: VoiceNote[] = newVoiceNotes.map((vn, index) => ({
        id: vn.id, durationMs: vn.durationMs, blobKey: processedVoiceNotes[index].url,
        createdAt: new Date().toISOString(),
    }));

    const finalTask: Task = {
      ...updatedTask,
      attachments: [...updatedTask.attachments, ...finalNewAttachments],
      voiceNotes: [...updatedTask.voiceNotes, ...finalNewVoiceNotes],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.id,
    };
    
    await firestoreService.dbPutTask(finalTask);
    showToast('Görev başarıyla güncellendi!', 'success');
  };
  
  const deleteTask = async (taskId: ID) => {
      const taskToDelete = tasks.find(t => t.id === taskId) ?? await firestoreService.dbGetTask(taskId);
      if (!taskToDelete) return;

      // Remove files from Storage
      for (const att of taskToDelete.attachments) await firestoreService.dbDeleteFile(att.blobKey);
      for (const note of taskToDelete.voiceNotes) await firestoreService.dbDeleteFile(note.blobKey);

      // Remove notifications for this task
      const relatedNotifications = await firestoreService.dbGetNotificationsByTaskId(taskId);
      await firestoreService.dbDeleteNotifications(relatedNotifications.map(n => n.id));
      
      await firestoreService.dbDeleteTask(taskId);
      showToast('Görev silindi.', 'info');
  };

  const moveTask = async (taskId: ID, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && currentUser) {
      const updatedTask: Task = { ...task, status: newStatus, updatedAt: new Date().toISOString(), updatedBy: currentUser.id };
      if (newStatus === TaskStatus.DONE) {
          updatedTask.completedAt = new Date().toISOString();
          const relatedNotifications = await firestoreService.dbGetNotificationsByTaskId(taskId);
          const notificationsToDelete = relatedNotifications
            .filter(n => n.type === NotificationType.DUE_SOON || n.type === NotificationType.OVERDUE)
            .map(n => n.id);
          if (notificationsToDelete.length > 0) {
              await firestoreService.dbDeleteNotifications(notificationsToDelete);
          }
      } else if (task.status === TaskStatus.DONE) {
          updatedTask.completedAt = undefined;
      }
      await firestoreService.dbPutTask(updatedTask);
    }
  };
  
    const archiveTasks = async (taskIds: ID[]) => {
      const tasksToArchive = tasks.filter(t => taskIds.includes(t.id));
      if (tasksToArchive.length === 0) return;

      for(const task of tasksToArchive) {
          const updated = { ...task, isArchived: true, completedAt: task.completedAt || new Date().toISOString() };
          await firestoreService.dbPutTask(updated);
      }
      
      showToast(`${tasksToArchive.length} görev arşivlendi.`, 'success');
  };
  
  const unarchiveTask = async (taskId: ID) => {
      const task = await firestoreService.dbGetTask(taskId);
      if (!task || !task.isArchived) return;

      const updatedTask = { ...task, isArchived: false };
      await firestoreService.dbPutTask(updatedTask);
      showToast('Görev arşive geri alındı.', 'success');
  };
  
  const addMember = async (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'password'>, password: string) => {
      // In a real app, you would use a Cloud Function to create the Firebase Auth user
      // and the Firestore user document atomically. This is a simplified client-side version.
      const now = new Date().toISOString();
      const newMember: Member = {
          ...memberData,
          id: crypto.randomUUID(), // For Firestore doc ID.
          password: password, // This should not be stored in production Firestore, this is just for demo.
          createdAt: now,
          updatedAt: now,
      };
      await firestoreService.dbPutMember(newMember);
      showToast('Yeni üye eklendi.', 'success');
  };

  const updateMember = async (updatedMember: Member, newAvatar?: File) => {
      let finalMember = { ...updatedMember, updatedAt: new Date().toISOString() };
      
      if (newAvatar) {
          const filePath = `avatars/${finalMember.id}/${newAvatar.name}`;
          const downloadURL = await firestoreService.dbUploadFile(filePath, newAvatar);
          finalMember.avatarUrl = downloadURL; // Use avatarUrl to store the path
      }

      await firestoreService.dbPutMember(finalMember);
      showToast('Profil güncellendi.', 'success');
  };
  
  const deleteMember = async (memberId: ID) => {
      // This is a simplified delete. A real app would need to handle re-assigning tasks.
      // Also, deleting a Firebase Auth user should be done via Admin SDK in a Cloud Function.
      await firestoreService.dbDeleteMember(memberId);
      showToast('Üye silindi.', 'info');
  };
  
  const updateColumnNames = async (newNames: Record<TaskStatus, string>) => {
      const newConfig: BoardConfig = { id: BOARD_CONFIG_ID, columnNames: newNames };
      await firestoreService.dbPutConfig(newConfig);
      showToast('Pano ayarları kaydedildi.', 'success');
  };

  const markNotificationAsRead = async (notificationId: ID) => {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
          const updatedNotification = { ...notification, isRead: true };
          await firestoreService.dbPutNotification(updatedNotification);
      }
  };

  const markAllNotificationsAsRead = async () => {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      if(unreadNotifications.length === 0) return;
      
      for(const n of unreadNotifications) {
          await firestoreService.dbPutNotification({...n, isRead: true});
      }
  };
  
  const updateNotificationSettings = (settings: NotificationSettings) => {
      setNotificationSettings(settings);
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
      showToast('Bildirim ayarları güncellendi.', 'success');
  };

  const resetBoard = async () => {
    showToast('Bu özellik Firebase ile devre dışı bırakılmıştır.', 'warning');
    // Board reset is complex with real users and data, should be a backend operation.
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast(`Başarıyla giriş yapıldı!`, 'success');
        return true;
    } catch (error) {
        console.error("Firebase sign-in error:", error);
        showToast('E-posta veya şifre yanlış.', 'error');
        return false;
    }
  };

  const signOut = () => {
    firebaseSignOut(auth).then(() => {
        showToast('Başarıyla çıkış yapıldı.', 'info');
    });
  };

  const contextValue: IKanbanContext = {
    tasks, members, columnNames, filters, loading, authLoading, currentUser,
    notifications, notificationSettings, addTask, updateTask, deleteTask, moveTask,
    archiveTasks, unarchiveTask, getMemberById, setFilters, addMember, updateMember,
    deleteMember, updateColumnNames, resetBoard, signIn, signOut,
    markNotificationAsRead, markAllNotificationsAsRead, updateNotificationSettings,
  };

  return <KanbanContext.Provider value={contextValue}>{children}</KanbanContext.Provider>;
};
