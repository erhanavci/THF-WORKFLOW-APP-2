
import { useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

export const useToast = () => {
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const event = new CustomEvent<ToastMessage>('add-toast', {
      detail: {
        id: Date.now(),
        message,
        type,
      },
    });
    window.dispatchEvent(event);
  }, []);

  return { showToast };
};
