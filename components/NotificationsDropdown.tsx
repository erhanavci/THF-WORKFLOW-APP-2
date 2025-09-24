import React, { useRef, useEffect } from 'react';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { BellIcon } from './icons/Icons';
import { Notification, NotificationType } from '../types';

interface NotificationsDropdownProps {
  onNotificationClick: (notificationId: string) => void;
  onClose: () => void;
}

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case NotificationType.OVERDUE:
            return <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>;
        case NotificationType.DUE_SOON:
            return <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>;
        case NotificationType.ASSIGNMENT:
            return <div className="w-2.5 h-2.5 bg-sky-500 rounded-full"></div>;
        default:
            return null;
    }
};


const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ onNotificationClick, onClose }) => {
  const { notifications, markAllNotificationsAsRead } = useKanbanStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={wrapperRef} className="absolute z-30 mt-2 w-80 origin-top-right right-0 bg-white border border-gray-200 rounded-md shadow-lg">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Bildirimler</h3>
        <button 
          onClick={markAllNotificationsAsRead}
          className="text-xs font-medium text-sky-600 hover:underline"
        >
          Tümünü okundu olarak işaretle
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => onNotificationClick(notification.id)}
              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${!notification.isRead ? 'bg-sky-50' : ''}`}
            >
              <div className="mt-1.5 shrink-0">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-grow">
                <p className="text-sm text-gray-700">{notification.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(notification.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!notification.isRead && (
                 <div className="mt-1 shrink-0 w-2 h-2 bg-sky-500 rounded-full" aria-label="Okunmamış"></div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center p-8 text-sm text-gray-500">
            <BellIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p>Okunmamış bildiriminiz yok.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsDropdown;
