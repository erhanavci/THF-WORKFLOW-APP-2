// FIX: The original file had incorrect imports causing type conflicts and undefined types.
// This was fixed by removing the faulty import and export statements, and defining the 'ID' type.
export type ID = string;

export enum MemberRole {
  ADMIN = 'Yönetici',
  MEMBER = 'Üye',
}

export enum TaskStatus {
  BACKLOG = 'Beklemede',
  TODO = 'Yapılacak',
  IN_PROGRESS = 'Devam Ediyor',
  DONE = 'Tamamlandı'
}

export enum TaskPriority {
    LOW = 'Düşük',
    MEDIUM = 'Orta',
    HIGH = 'Yüksek',
}

export const AllTaskStatuses: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
];

export const AllTaskPriorities: TaskPriority[] = [
    TaskPriority.LOW,
    TaskPriority.MEDIUM,
    TaskPriority.HIGH,
];


export interface Member {
  id: ID; // This will be the Firebase Auth UID
  name: string;
  email: string;
  role: MemberRole;
  avatarUrl?: string; // Will store Firebase Storage URL
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export interface Attachment {
  id: ID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;        // URL from Firebase Storage
  createdAt: string;
};

export interface VoiceNote {
  id: ID;
  url: string;       // URL from Firebase Storage
  durationMs: number;
  createdAt: string;
};

export interface Note {
  id: ID;
  content: string;
  authorId: ID;
  createdAt: string; // ISO
}

export interface Task {
  id: ID;
  title: string;
  description?: string;
  dueDate?: string;   // ISO
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: ID[];  // must include responsibleId
  responsibleId: ID;  // required
  attachments: Attachment[];
  voiceNotes: VoiceNote[];
  notes: Note[];
  createdAt: string;
  updatedAt: string;
  creatorId: ID;
  updatedBy?: ID;
  isArchived?: boolean;
  completedAt?: string; // ISO
};

export interface FilterState {
  searchTerm: string;
  assigneeIds: ID[];
  responsibleId?: ID;
  dueDate?: 'overdue' | 'this_week' | null;
}

export interface BoardConfig {
  id: string; // Should be a constant value for singleton config
  columnNames: Record<TaskStatus, string>;
}

export enum NotificationType {
  OVERDUE = 'OVERDUE',
  DUE_SOON = 'DUE_SOON',
  ASSIGNMENT = 'ASSIGNMENT',
}

export interface Notification {
  id: ID;
  recipientId: ID;
  taskId: ID;
  taskTitle: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string; // ISO
}
