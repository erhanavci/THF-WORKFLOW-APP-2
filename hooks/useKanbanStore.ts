import { useContext } from 'react';
import { KanbanContext } from '../context/KanbanContext';

export const useKanbanStore = () => {
  const context = useContext(KanbanContext);
  if (context === undefined) {
    throw new Error('useKanbanStore must be used within a KanbanProvider');
  }
  return context;
};