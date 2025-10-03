import { TaskStatus } from './types';

export const BOARD_CONFIG_ID = 'main_board_config';

export const DEFAULT_COLUMN_NAMES: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: 'Beklemede',
    [TaskStatus.TODO]: 'Yapılacak',
    [TaskStatus.IN_PROGRESS]: 'Devam Ediyor',
    [TaskStatus.DONE]: 'Tamamlandı',
};
