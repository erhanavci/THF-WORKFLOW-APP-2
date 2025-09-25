


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
import {
  TEAM_MEMBERS_SEED,
  TASKS_SEED,
  DB_CONFIG,
  BOARD_CONFIG_ID,
  DEFAULT_COLUMN_NAMES,
} from '../constants';
import { useToast } from '../hooks/useToast';
import { isOverdue } from '../utils/helpers';

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
  addMember: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
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

// Create a single BroadcastChannel for the application
const channel = new BroadcastChannel('thf-workflow-sync');

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
  const { showToast } = useToast();

  const getMemberById = useCallback((id: ID) => members.find(m => m.id === id), [members]);

  const refreshNotifications = useCallback(async (user: Member) => {
    const allNotifications = await db.dbGetNotifications();
    const userNotifications = allNotifications
      .filter(n => n.recipientId === user.id)
      .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setNotifications(userNotifications);
  }, []);

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
        channel.postMessage({ type: 'data-changed', payload: 'notifications' });
      }

      if (newNotifications.length > 0) {
          for (const n of newNotifications) await db.dbPutNotification(n);
          channel.postMessage({ type: 'data-changed', payload: 'notifications' });
      }
      
      if (notificationsToDelete.length > 0 || newNotifications.length > 0) {
          await refreshNotifications(user);
      }
  }, [notificationSettings.enabled, refreshNotifications]);

  // Data initialization effect, runs only once on mount
  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        const savedSettings = localStorage.getItem('notificationSettings');
        if (savedSettings) {
          setNotificationSettings(JSON.parse(savedSettings));
        }

        // Seeding is now handled by db.ts on creation. We just need to load data.
        
        // Restore session if available
        const loggedInUserEmail = sessionStorage.getItem('currentUserEmail');
        if (loggedInUserEmail) {
            const allMembers = await db.dbGetMembers();
            const user = allMembers.find(m => m.email.toLowerCase() === loggedInUserEmail.toLowerCase());
            if (user) {
              const allTasks = await db.dbGetTasks();
              const boardConfig = await db.dbGetConfig(BOARD_CONFIG_ID);
              const activeTasks = allTasks.filter(t => !t.isArchived);
              
              setMembers(allMembers);
              setTasks(activeTasks);
              setColumnNames(boardConfig?.columnNames || DEFAULT_COLUMN_NAMES);
              setCurrentUser(user);
              await refreshNotifications(user);
            }
        }
      } catch (error) {
        console.error('Database initialization failed:', error);
        showToast('Uygulama verileri yüklenemedi.', 'error');
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAllData = useCallback(async (source?: string) => {
    if (source) console.log(`[KanbanSync] Refreshing data due to: ${source}`);
    try {
      const [allTasks, allMembers, allNotifications, boardConfig] = await Promise.all([
        db.dbGetTasks(),
        db.dbGetMembers(),
        db.dbGetNotifications(),
        db.dbGetConfig(BOARD_CONFIG_ID)
      ]);
      
      setTasks(allTasks.filter(t => !t.isArchived));
      setMembers(allMembers);
      setColumnNames(boardConfig?.columnNames || DEFAULT_COLUMN_NAMES);

      const loggedInUserEmail = sessionStorage.getItem('currentUserEmail');
      const latestCurrentUser = allMembers.find(m => m.email.toLowerCase() === loggedInUserEmail?.toLowerCase());

      if (latestCurrentUser) {
        setCurrentUser(latestCurrentUser);
        const userNotifications = allNotifications
          .filter(n => n.recipientId === latestCurrentUser.id)
          .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(userNotifications);
      }
    } catch (error) {
      console.error("Failed to refresh data from DB:", error);
      showToast("Veriler senkronize edilemedi.", "error");
    }
  }, [showToast]);

  // Effect for real-time synchronization between tabs
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'data-changed') {
            refreshAllData(`broadcast message (${event.data.payload})`);
        }
    };
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            refreshAllData('tab became visible');
        }
    };
    const handleFocus = () => refreshAllData('window focused');

    channel.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
        channel.removeEventListener('message', handleMessage);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
    };
  }, [refreshAllData]);

  // Effect for checking and generating notifications when relevant data changes.
  useEffect(() => {
    if (loading || !currentUser) return;

    const check = async () => {
      const allNotifications = await db.dbGetNotifications();
      const userNotifications = allNotifications.filter(n => n.recipientId === currentUser.id);
      await checkAndGenerateNotifications(currentUser, tasks, userNotifications);
    };

    check();
  }, [loading, currentUser, tasks, checkAndGenerateNotifications]);


  const processNewAttachments = async (newAttachments: { file: File; id: string }[]): Promise<Attachment[]> => {
    const processed: Attachment[] = [];
    for (const { file, id } of newAttachments) {
      const blobKey = crypto.randomUUID();
      await db.dbPutBlob(DB_CONFIG.STORES.ATTACHMENTS, blobKey, file);
      processed.push({
        id,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        blobKey,
        createdAt: new Date().toISOString(),
      });
    }
    return processed;
  };

  const processNewVoiceNotes = async (newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]): Promise<VoiceNote[]> => {
    const processed: VoiceNote[] = [];
    for (const { blob, durationMs, id } of newVoiceNotes) {
      const blobKey = crypto.randomUUID();
      await db.dbPutBlob(DB_CONFIG.STORES.VOICE_NOTES, blobKey, blob);
      processed.push({
        id,
        blobKey,
        durationMs,
        createdAt: new Date().toISOString(),
      });
    }
    return processed;
  };

  const removeBlobs = async (attachmentsToRemove: Attachment[], voiceNotesToRemove: VoiceNote[]) => {
    for (const att of attachmentsToRemove) {
        await db.dbDeleteBlob(DB_CONFIG.STORES.ATTACHMENTS, att.blobKey);
    }
    for (const note of voiceNotesToRemove) {
        await db.dbDeleteBlob(DB_CONFIG.STORES.VOICE_NOTES, note.blobKey);
    }
  };

  const addTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'creatorId'>,
    newAttachments: { file: File; id: string }[],
    newVoiceNotes: { blob: Blob; durationMs: number; id: string }[]
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    
    const processedAttachments = await processNewAttachments(newAttachments);
    const processedVoiceNotes = await processNewVoiceNotes(newVoiceNotes);

    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: currentUser.id,
      attachments: processedAttachments,
      voiceNotes: processedVoiceNotes,
    };
    
    let notificationsAdded = false;
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
                notificationsAdded = true;
            }
        }
    }

    await db.dbPutTask(newTask);
    setTasks(prev => [...prev, newTask]);
    channel.postMessage({ type: 'data-changed', payload: 'tasks' });
    if (notificationsAdded) {
        channel.postMessage({ type: 'data-changed', payload: 'notifications' });
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
    
    const originalTask = tasks.find(t => t.id === updatedTask.id) ?? await db.dbGetTask(updatedTask.id);
    if (!originalTask) {
        showToast("Güncellenecek görev bulunamadı.", 'error');
        return;
    }

    let notificationsAdded = false;
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
                notificationsAdded = true;
            }
        }
    }

    let completedAt = originalTask.completedAt;
    let notificationsRemoved = false;
    if (updatedTask.status !== originalTask.status) {
        if (updatedTask.status === TaskStatus.DONE) {
            completedAt = new Date().toISOString();
            const userNotifications = await db.dbGetNotifications();
            const notificationsToDelete = userNotifications
                .filter(n => n.taskId === updatedTask.id && (n.type === NotificationType.DUE_SOON || n.type === NotificationType.OVERDUE))
                .map(n => n.id);
            if (notificationsToDelete.length > 0) {
                await db.dbDeleteNotifications(notificationsToDelete);
                if(currentUser) await refreshNotifications(currentUser);
                notificationsRemoved = true;
            }
        } else if (originalTask.status === TaskStatus.DONE) {
            completedAt = undefined;
        }
    }

    const processedAttachments = await processNewAttachments(newAttachments);
    const processedVoiceNotes = await processNewVoiceNotes(newVoiceNotes);
    await removeBlobs(attachmentsToRemove, voiceNotesToRemove);

    const finalTask = {
      ...updatedTask,
      completedAt,
      attachments: [...updatedTask.attachments, ...processedAttachments],
      voiceNotes: [...updatedTask.voiceNotes, ...processedVoiceNotes],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.id,
    };

    await db.dbPutTask(finalTask);
    const updatedTasks = tasks.map(t => t.id === finalTask.id ? finalTask : t);
    setTasks(updatedTasks);
    channel.postMessage({ type: 'data-changed', payload: 'tasks' });
    if(notificationsAdded || notificationsRemoved) {
      channel.postMessage({ type: 'data-changed', payload: 'notifications' });
    }
    showToast('Görev başarıyla güncellendi!', 'success');
  };
  
  const deleteTask = async (taskId: ID) => {
      const taskToDelete = tasks.find(t => t.id === taskId);
      if (!taskToDelete) return;

      // Remove blobs
      await removeBlobs(taskToDelete.attachments, taskToDelete.voiceNotes);

      // Remove task
      await db.dbDeleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      channel.postMessage({ type: 'data-changed', payload: 'tasks' });
      showToast('Görev silindi.', 'info');
  };

  const moveTask = async (taskId: ID, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && currentUser) {
      let completedAt = task.completedAt;
      let notificationsRemoved = false;
      if (newStatus === TaskStatus.DONE) {
          completedAt = new Date().toISOString();
          const userNotifications = await db.dbGetNotifications();
          const notificationsToDelete = userNotifications
              .filter(n => n.taskId === taskId && (n.type === NotificationType.DUE_SOON || n.type === NotificationType.OVERDUE))
              .map(n => n.id);
          if (notificationsToDelete.length > 0) {
              await db.dbDeleteNotifications(notificationsToDelete);
              await refreshNotifications(currentUser);
              notificationsRemoved = true;
          }
      } else if (task.status === TaskStatus.DONE) {
          completedAt = undefined;
      }
      const updatedTask = { ...task, status: newStatus, updatedAt: new Date().toISOString(), updatedBy: currentUser.id, completedAt };
      await db.dbPutTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      channel.postMessage({ type: 'data-changed', payload: 'tasks' });
      if (notificationsRemoved) {
          channel.postMessage({ type: 'data-changed', payload: 'notifications' });
      }
    }
  };
  
  const archiveTasks = async (taskIds: ID[]) => {
      const tasksToArchive = tasks.filter(t => taskIds.includes(t.id));
      if (tasksToArchive.length === 0) return;

      const updatedTasks: Task[] = [];
      for(const task of tasksToArchive) {
          const updated = { ...task, isArchived: true, completedAt: task.completedAt || new Date().toISOString() };
          updatedTasks.push(updated);
          await db.dbPutTask(updated);
      }
      
      setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
      channel.postMessage({ type: 'data-changed', payload: 'tasks' });
      showToast(`${updatedTasks.length} görev arşivlendi.`, 'success');
  };
  
  const unarchiveTask = async (taskId: ID) => {
      const task = await db.dbGetTask(taskId);
      if (!task || !task.isArchived) return;

      const updatedTask = { ...task, isArchived: false };
      await db.dbPutTask(updatedTask);
      setTasks(prev => [...prev, updatedTask].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      channel.postMessage({ type: 'data-changed', payload: 'tasks' });
      showToast('Görev arşive geri alındı.', 'success');
  };
  
  const addMember = async (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newMember: Member = {
          ...memberData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
      };
      await db.dbPutMember(newMember);
      setMembers(prev => [...prev, newMember]);
      channel.postMessage({ type: 'data-changed', payload: 'members' });
      showToast('Yeni üye eklendi.', 'success');
  };

  const updateMember = async (updatedMember: Member, newAvatar?: File) => {
      let finalMember = { ...updatedMember, updatedAt: new Date().toISOString() };
      
      if (newAvatar) {
          const blobKey = updatedMember.avatarBlobKey || crypto.randomUUID();
          await db.dbPutBlob(DB_CONFIG.STORES.AVATARS, blobKey, newAvatar);
          finalMember.avatarBlobKey = blobKey;
          finalMember.avatarUrl = undefined; // Prioritize blob over URL
      }

      await db.dbPutMember(finalMember);
      setMembers(prev => prev.map(m => m.id === finalMember.id ? finalMember : m));
      if (currentUser?.id === finalMember.id) {
          setCurrentUser(finalMember);
      }
      channel.postMessage({ type: 'data-changed', payload: 'members' });
      showToast('Profil güncellendi.', 'success');
  };
  
  const deleteMember = async (memberId: ID) => {
      // Basic deletion, doesn't handle re-assigning tasks
      await db.dbDeleteMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      channel.postMessage({ type: 'data-changed', payload: 'members' });
      showToast('Üye silindi.', 'info');
  };
  
  const updateColumnNames = async (newNames: Record<TaskStatus, string>) => {
      const newConfig: BoardConfig = { id: BOARD_CONFIG_ID, columnNames: newNames };
      await db.dbPutConfig(newConfig);
      setColumnNames(newNames);
      channel.postMessage({ type: 'data-changed', payload: 'config' });
      showToast('Pano ayarları kaydedildi.', 'success');
  };

  const clearAllTasks = async () => {
      await db.dbClearTasks();
      await db.dbClearStore(DB_CONFIG.STORES.ATTACHMENTS);
      await db.dbClearStore(DB_CONFIG.STORES.VOICE_NOTES);
      setTasks([]);
      channel.postMessage({ type: 'data-changed', payload: 'tasks' });
      showToast('Tüm görevler silindi.', 'warning');
  };
  
  const markNotificationAsRead = async (notificationId: ID) => {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
          const updatedNotification = { ...notification, isRead: true };
          await db.dbPutNotification(updatedNotification);
          setNotifications(prev => prev.map(n => n.id === notificationId ? updatedNotification : n));
          channel.postMessage({ type: 'data-changed', payload: 'notifications' });
      }
  };

  const markAllNotificationsAsRead = async () => {
      if (!currentUser) return;
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      if(unreadIds.length === 0) return;
      
      const updatedNotifications: Notification[] = [];
      let changed = false;
      for(const n of notifications) {
          if(!n.isRead) {
              const updated = {...n, isRead: true};
              updatedNotifications.push(updated);
              await db.dbPutNotification(updated);
              changed = true;
          } else {
              updatedNotifications.push(n);
          }
      }
      setNotifications(updatedNotifications);
      if (changed) {
        channel.postMessage({ type: 'data-changed', payload: 'notifications' });
      }
  };
  
  const updateNotificationSettings = (settings: NotificationSettings) => {
      setNotificationSettings(settings);
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
      showToast('Bildirim ayarları güncellendi.', 'success');
  };
  
  const resetBoard = async (showMsg=true) => {
    setLoading(true);
    await db.dbClearTasks();
    await db.dbClearMembers();
    await db.dbClearStore(DB_CONFIG.STORES.ATTACHMENTS);
    await db.dbClearStore(DB_CONFIG.STORES.VOICE_NOTES);
    await db.dbClearStore(DB_CONFIG.STORES.AVATARS);
    await db.dbClearNotifications();
    
    const now = new Date().toISOString();
    const seededMembers: Member[] = [];
    for (const memberSeed of TEAM_MEMBERS_SEED) {
        const newMember: Member = {
            ...memberSeed,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
        };
        await db.dbPutMember(newMember);
        seededMembers.push(newMember);
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
    
    setMembers(seededMembers);
    setTasks(seededTasks);
    setColumnNames(DEFAULT_COLUMN_NAMES);
    channel.postMessage({ type: 'data-changed', payload: 'all' });

    if (showMsg) {
      showToast('Pano başarıyla sıfırlandı!', 'success');
    }
    setLoading(false);
  };

  // Auth
  const signIn = async (email: string, password: string): Promise<boolean> => {
    // Fetch members directly from the database to avoid race conditions.
    // This ensures login works even if the app's state hasn't been hydrated yet.
    const allMembersFromDb = await db.dbGetMembers();
    const user = allMembersFromDb.find(m => m.email.toLowerCase() === email.trim().toLowerCase());
    
    if (user && user.password === password) {
        setCurrentUser(user);
        
        // Populate the state immediately after login to ensure the UI is consistent.
        setMembers(allMembersFromDb);
        const allTasks = await db.dbGetTasks();
        const activeTasks = allTasks.filter(task => !task.isArchived);
        setTasks(activeTasks);

        try {
            sessionStorage.setItem('currentUserEmail', user.email);
        } catch (e) {
            console.warn('Session storage is not available.', e);
        }
        showToast(`Hoş geldin, ${user.name}!`, 'success');
        
        await refreshNotifications(user);
        return true;
    }
    showToast('E-posta veya şifre yanlış.', 'error');
    return false;
  };

  const signOut = () => {
    setCurrentUser(null);
    setNotifications([]);
    setTasks([]); // Clear tasks from state on sign out to prevent flash of old data
    try {
        sessionStorage.removeItem('currentUserEmail');
    } catch (e) {
        console.warn('Session storage is not available.', e);
    }
    showToast('Başarıyla çıkış yapıldı.', 'info');
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