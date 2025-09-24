
import React, { useState, useEffect, useCallback } from 'react';
import { ToastMessage, ToastType } from '../../hooks/useToast';

const toastConfig = {
    success: { bg: 'bg-green-500', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
    error: { bg: 'bg-red-500', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' },
    info: { bg: 'bg-blue-500', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' },
    warning: { bg: 'bg-yellow-500', icon: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' }
};


const Toast: React.FC<{ toast: ToastMessage, onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(toast.id), 300);
        }, 3000);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);
    
    const config = toastConfig[toast.type];

    return (
        <div 
          className={`flex items-center text-white p-4 rounded-md shadow-lg mb-2 transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} ${config.bg}`}
          role="alert"
          aria-live="assertive"
        >
            <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24"><path d={config.icon}></path></svg>
            <span>{toast.message}</span>
        </div>
    );
};

export const Toaster: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const handleAddToast = useCallback((e: Event) => {
        const detail = (e as CustomEvent<ToastMessage>).detail;
        setToasts(currentToasts => [...currentToasts, detail]);
    }, []);
    
    const dismissToast = useCallback((id: number) => {
        setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        window.addEventListener('add-toast', handleAddToast);
        return () => {
            window.removeEventListener('add-toast', handleAddToast);
        };
    }, [handleAddToast]);

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
            ))}
        </div>
    );
};
