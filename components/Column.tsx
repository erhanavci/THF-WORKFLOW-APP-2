import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import { Task, TaskStatus, ID } from '../types';
import TaskCard from './TaskCard';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { ArchiveIcon } from './icons/Icons';

interface ColumnProps {
    status: TaskStatus;
    tasks: Task[];
}

const Column: React.FC<ColumnProps> = ({ status, tasks }) => {
    const { moveTask, columnNames, archiveTasks } = useKanbanStore();
    const [selectedTaskIds, setSelectedTaskIds] = useState<ID[]>([]);

    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'TASK',
        drop: (item: { id: string }) => moveTask(item.id, status),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
            canDrop: !!monitor.canDrop(),
        }),
    }), [status, moveTask]);

    const handleToggleSelection = (taskId: ID) => {
        setSelectedTaskIds(prev =>
            prev.includes(taskId)
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId]
        );
    };

    const handleArchiveSelected = () => {
        archiveTasks(selectedTaskIds);
        setSelectedTaskIds([]);
    };

    const getStatusStyles = (s: TaskStatus) => {
        switch(s) {
            case TaskStatus.BACKLOG: return {
                bg: 'bg-gray-500',
                badgeBg: 'bg-black/20',
            };
            case TaskStatus.TODO: return {
                bg: 'bg-sky-500',
                badgeBg: 'bg-black/20',
            };
            case TaskStatus.IN_PROGRESS: return {
                bg: 'bg-amber-500',
                badgeBg: 'bg-black/20',
            };
            case TaskStatus.DONE: return {
                bg: 'bg-emerald-500',
                badgeBg: 'bg-black/20',
            };
        }
    }

    const styles = getStatusStyles(status);

    return (
        <div
            ref={drop as any}
            className={`flex flex-col rounded-xl transition-all duration-200 bg-gray-100 shadow-sm ${isOver && canDrop ? 'ring-2 ring-sky-500' : 'ring-1 ring-gray-200'}`}
        >
            <header className={`p-4 flex items-center justify-between rounded-t-xl ${styles.bg}`}>
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg text-white">{columnNames[status]}</h3>
                    <span className={`text-sm font-medium text-white rounded-full px-2.5 py-0.5 ${styles.badgeBg}`}>{tasks.length}</span>
                </div>
                {status === TaskStatus.DONE && tasks.length > 0 && (
                    <button
                        onClick={handleArchiveSelected}
                        disabled={selectedTaskIds.length === 0}
                        className="text-sm font-medium text-white rounded-md px-2 py-1 flex items-center gap-1.5 hover:bg-black/20 transition-colors disabled:bg-black/10 disabled:cursor-not-allowed"
                        title="Seçilen görevleri arşivle"
                    >
                        <ArchiveIcon className="w-4 h-4" />
                        <span>Arşivle ({selectedTaskIds.length})</span>
                    </button>
                )}
            </header>
            <div className="flex-grow p-2 space-y-4 overflow-y-auto">
                {tasks.length > 0 ? (
                    tasks.map(task => <TaskCard 
                        key={task.id} 
                        task={task}
                        isSelectable={status === TaskStatus.DONE}
                        isSelected={selectedTaskIds.includes(task.id)}
                        onToggleSelection={handleToggleSelection}
                    />)
                ) : (
                    <div className="text-center text-gray-500 py-10 px-4 border-2 border-dashed border-gray-200 rounded-lg m-2">
                        <p>Henüz görev yok.</p>
                        <p className="text-sm">Eklemek için bir görevi buraya sürükleyin.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Column;