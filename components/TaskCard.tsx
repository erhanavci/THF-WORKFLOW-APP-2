import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Task, Member, TaskStatus, TaskPriority, ID } from '../types';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { formatDate, isOverdue, getDaysUntil } from '../utils/helpers';
import TaskModal from './TaskModal';
import Avatar from './Avatar';
import { PriorityHighIcon, PriorityMediumIcon, PriorityLowIcon } from './icons/Icons';


interface TaskCardProps {
    task: Task;
    isSelectable?: boolean;
    isSelected?: boolean;
    onToggleSelection?: (taskId: ID) => void;
}

const AttachmentIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
);

const MicIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
);

const NoteIcon: React.FC = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
);

const PriorityIcon: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
    const priorityStyles = {
        [TaskPriority.HIGH]: { icon: PriorityHighIcon, color: 'text-red-500' },
        [TaskPriority.MEDIUM]: { icon: PriorityMediumIcon, color: 'text-amber-500' },
        [TaskPriority.LOW]: { icon: PriorityLowIcon, color: 'text-emerald-500' },
    };
    const style = priorityStyles[priority];
    if (!style) return null;
    const IconComponent = style.icon;

    return (
        <div className="relative group flex items-center">
            <IconComponent className={`w-4 h-4 ${style.color}`} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                {priority} Öncelik
            </div>
        </div>
    );
};

const TaskCard: React.FC<TaskCardProps> = ({ task, isSelectable, isSelected, onToggleSelection }) => {
    const { getMemberById } = useKanbanStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const assignees = task.assigneeIds.map(getMemberById).filter(Boolean) as Member[];
    const responsibleMember = getMemberById(task.responsibleId);
    const lastEditor = task.updatedBy ? getMemberById(task.updatedBy) : null;
    const overdue = task.status !== TaskStatus.DONE && isOverdue(task.dueDate);
    const countdown = task.status !== TaskStatus.DONE ? getDaysUntil(task.dueDate) : null;
    
    const latestNote = task.notes.length > 0 ? task.notes[task.notes.length - 1] : null;
    const noteAuthor = latestNote ? getMemberById(latestNote.authorId) : null;

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'TASK',
        item: { id: task.id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [task.id]);

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleSelection) {
            onToggleSelection(task.id);
        }
    };

    return (
        <>
            <div
                ref={drag as any}
                onClick={() => setIsModalOpen(true)}
                className={`relative bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col justify-between ${isDragging ? 'opacity-50 ring-2 ring-sky-500 shadow-2xl scale-105' : 'shadow-sm'} ${isSelected ? 'ring-2 ring-sky-500 bg-sky-50' : 'ring-1 ring-gray-200'}`}
                role="button"
                aria-label={`Görevi düzenle: ${task.title}`}
            >
                {isSelectable && (
                    <div 
                        className="absolute top-2 right-2 z-10 p-1 rounded-full hover:bg-gray-200"
                        onClick={handleCheckboxClick}
                        aria-label="Görevi arşivlemek için seç"
                    >
                        <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-5 w-5 rounded border-gray-400 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                    </div>
                )}
                <div>
                    <h4 className="font-semibold mb-2 text-gray-900 pr-8">{task.title}</h4>

                    {latestNote && (
                        <div className="mb-2 text-sm text-gray-600 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2">
                                {noteAuthor && <Avatar member={noteAuthor} size="sm" />}
                                <p className="truncate flex-1">
                                    <span className="font-semibold">{noteAuthor ? noteAuthor.name.split(' ')[0] : 'Not'}:</span> {latestNote.content}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-3">
                            <PriorityIcon priority={task.priority} />
                            {task.notes.length > 0 && <span className="flex items-center gap-1"><NoteIcon /> {task.notes.length}</span>}
                            {task.attachments.length > 0 && <span className="flex items-center gap-1"><AttachmentIcon /> {task.attachments.length}</span>}
                            {task.voiceNotes.length > 0 && <span className="flex items-center gap-1"><MicIcon /> {task.voiceNotes.length}</span>}
                        </div>
                         {task.dueDate && (
                            <div className="text-right">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${overdue ? 'bg-red-100 text-red-800' : 'bg-white border border-gray-200'}`}>
                                    {formatDate(task.dueDate)}
                                </span>
                                {countdown && (
                                    <p className={`text-xs mt-1 font-semibold ${countdown.color}`}>
                                        {countdown.text}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4">
                    <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex -space-x-2">
                            {assignees.map(member => <Avatar key={member.id} member={member} />)}
                        </div>
                        {responsibleMember && (
                             <div className="relative group">
                                <Avatar member={responsibleMember} size="md" responsible />
                                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                    Sorumlu: {responsibleMember.name}
                                </div>
                            </div>
                        )}
                    </div>
                     {lastEditor && (
                        <p className="text-xs text-gray-400 mt-3 text-right truncate">
                            Düzenleyen: {lastEditor.name}
                        </p>
                    )}
                </div>
            </div>
            {isModalOpen && <TaskModal task={task} onClose={() => setIsModalOpen(false)} />}
        </>
    );
};

export default TaskCard;