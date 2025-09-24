import React, { useMemo } from 'react';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { AllTaskStatuses, Task, TaskPriority, TaskStatus } from '../types';
import Column from './Column';
import { isOverdue, isThisWeek } from '../utils/helpers';

const Board: React.FC = () => {
    const { tasks, filters, loading } = useKanbanStore();

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const searchTermMatch = task.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                task.description?.toLowerCase().includes(filters.searchTerm.toLowerCase());
            
            const responsibleMatch = !filters.responsibleId || task.responsibleId === filters.responsibleId;
            
            const assigneeMatch = filters.assigneeIds.length === 0 || task.assigneeIds.some(id => filters.assigneeIds.includes(id));

            const dueDateMatch = !filters.dueDate ||
                (filters.dueDate === 'overdue' && task.status !== TaskStatus.DONE && isOverdue(task.dueDate)) ||
                (filters.dueDate === 'this_week' && isThisWeek(task.dueDate));

            return searchTermMatch && responsibleMatch && assigneeMatch && dueDateMatch;
        });
    }, [tasks, filters]);

    if (loading) {
        return <div className="flex justify-center items-center h-full"><p>Pano yükleniyor...</p></div>;
    }

    const sortTasks = (tasksToSort: Task[]) => {
        return [...tasksToSort].sort((a, b) => {
            const priorityOrder = {
                [TaskPriority.HIGH]: 0,
                [TaskPriority.MEDIUM]: 1,
                [TaskPriority.LOW]: 2,
            };

            // 1. Sort by priority
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }

            // 2. Sort by due date (earlier is higher priority, no due date is lowest)
            const aDueDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bDueDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            if (aDueDate !== bDueDate) {
                return aDueDate - bDueDate;
            }

            // 3. Sort by creation date (newer first)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    };


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {AllTaskStatuses.map(status => (
                <div key={status}>
                    <Column
                        status={status}
                        tasks={sortTasks(filteredTasks.filter(task => task.status === status))}
                    />
                </div>
            ))}
        </div>
    );
};

export default Board;