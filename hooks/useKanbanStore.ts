import { useContext } from 'react';
// FIX: Corrected import for KanbanContext as the file was missing content.
import { KanbanContext } from '../context/KanbanContext';

export const useKanbanStore = () => {
  const context = useContext(KanbanContext);
  if (context === undefined) {
    throw new Error('useKanbanStore must be used within a KanbanProvider');
  }
  return context;
};