import { Member, Task, TaskStatus, MemberRole, TaskPriority } from './types';

export const TEAM_MEMBERS_SEED: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Erhan Avcı', email: 'erhan.avci@thf.org.tr', role: MemberRole.ADMIN, avatarUrl: 'https://i.pravatar.cc/150?u=erhan.avci@thf.org.tr', password: 'password123' },
  { name: 'Berke Özkan', email: 'berke.ozkan@thf.org.tr', role: MemberRole.MEMBER, avatarUrl: 'https://i.pravatar.cc/150?u=berke.ozkan@thf.org.tr', password: 'password123' },
];

export const TASKS_SEED: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'responsibleId' | 'assigneeIds' | 'updatedBy' | 'creatorId'>[] = [
    {
        title: 'Yeni açılış sayfası tasarla',
        description: 'Ana açılış sayfası için modern ve duyarlı bir tasarım oluşturun.',
        status: TaskStatus.BACKLOG,
        priority: TaskPriority.HIGH,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [],
        voiceNotes: [],
        notes: [],
        isArchived: false,
    },
    {
        title: 'Kullanıcı doğrulama API\'si geliştir',
        description: 'Giriş, kayıt ve çıkış için JWT tabanlı kimlik doğrulama uç noktalarını uygulayın.',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [],
        voiceNotes: [],
        notes: [],
        isArchived: false,
    },
    {
        title: 'Sürükle-bırak özelliğini uygula',
        description: 'Kanban panosundaki görev kartları için sürükle ve bırak işlevini etkinleştirin.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [],
        voiceNotes: [],
        notes: [],
        isArchived: false,
    },
    {
        title: 'Mobil düzen hatalarını düzelt',
        description: 'Özellikle gösterge panelindeki küçük ekran boyutlarındaki CSS sorunlarını çözün.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Overdue
        attachments: [],
        voiceNotes: [],
        notes: [],
        isArchived: false,
    },
    {
        title: 'Test ortamını dağıtıma al',
        description: 'Test sunucusuna otomatik dağıtımlar için CI/CD ardışık düzenini kurun.',
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        attachments: [],
        voiceNotes: [],
        notes: [],
        isArchived: false,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

export const DB_CONFIG = {
  DB_NAME: 'KanbanFlowDB',
  DB_VERSION: 4,
  STORES: {
    TASKS: 'tasks',
    MEMBERS: 'members',
    ATTACHMENTS: 'attachments',
    VOICE_NOTES: 'voice_notes',
    CONFIG: 'config',
    AVATARS: 'avatars',
    NOTIFICATIONS: 'notifications',
  },
};

export const BOARD_CONFIG_ID = 'main_board_config';

export const DEFAULT_COLUMN_NAMES: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: 'Beklemede',
    [TaskStatus.TODO]: 'Yapılacak',
    [TaskStatus.IN_PROGRESS]: 'Devam Ediyor',
    [TaskStatus.DONE]: 'Tamamlandı',
};