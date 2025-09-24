import React, { useState } from 'react';
import TaskModal from './TaskModal';
import FilterDropdown from './FilterDropdown';
import UserMenu from './UserMenu';
import ArchiveModal from './ArchiveModal';
import { ArchiveIcon, BellIcon } from './icons/Icons';
import NotificationsDropdown from './NotificationsDropdown';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { Task } from '../types';
import { logoLight } from '../assets/logo';
import LiveIndicator from './LiveIndicator';

interface HeaderProps {
    onAdminPanelClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onAdminPanelClick }) => {
    const { notifications, tasks, markNotificationAsRead } = useKanbanStore();
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{isOpen: boolean, task?: Task}>({isOpen: false, task: undefined});

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleOpenNewTaskModal = () => {
        setModalConfig({ isOpen: true, task: undefined });
    };

    const handleNotificationClick = (notificationId: string) => {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return;
        
        const task = tasks.find(t => t.id === notification.taskId);
        if (task) {
            setModalConfig({ isOpen: true, task: task });
            if (!notification.isRead) {
                markNotificationAsRead(notification.id);
            }
        }
        setIsNotificationsOpen(false);
    };

    return (
        <>
            <header className="bg-white/70 backdrop-blur-lg shadow-sm p-4 flex items-center justify-between gap-4 sticky top-0 z-20 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div>
                        <img src={logoLight} alt="THF WORKFLOW" className="h-8" />
                        <span className="sr-only">THF WORKFLOW</span>
                    </div>
                    <LiveIndicator />
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4">
                    <FilterDropdown />

                    <button
                        onClick={() => setIsArchiveModalOpen(true)}
                        className="px-3 sm:px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <ArchiveIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Arşiv</span>
                    </button>

                     <div className="relative">
                        <button
                            onClick={() => setIsNotificationsOpen(prev => !prev)}
                            className="p-2 text-gray-600 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                            aria-label="Bildirimleri göster"
                        >
                            <BellIcon className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </button>
                        {isNotificationsOpen && (
                            <NotificationsDropdown 
                                onNotificationClick={handleNotificationClick}
                                onClose={() => setIsNotificationsOpen(false)}
                            />
                        )}
                    </div>

                    <button
                        onClick={handleOpenNewTaskModal}
                        className="px-3 sm:px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 transition-colors duration-200"
                    >
                        +<span className="hidden sm:inline ml-1">Yeni Görev</span>
                    </button>

                    <UserMenu onAdminPanelClick={onAdminPanelClick} />
                </div>
            </header>
            {modalConfig.isOpen && <TaskModal task={modalConfig.task} onClose={() => setModalConfig({isOpen: false})} />}
            {isArchiveModalOpen && <ArchiveModal isOpen={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} />}
        </>
    );
};

export default Header;