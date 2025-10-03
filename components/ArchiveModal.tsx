import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { Task } from '../types';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { formatDateTime } from '../utils/helpers';
import Avatar from './Avatar';
import { UndoIcon } from './icons/Icons';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose }) => {
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { getMemberById, unarchiveTask } = useKanbanStore();
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchArchived = async () => {
        setLoading(true);
        const q = query(
            collection(db, "tasks"), 
            where("isArchived", "==", true),
            orderBy("completedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const archived = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Task));

        setArchivedTasks(archived);
        setLoading(false);
        // Automatically open the first month if available
        if (archived.length > 0 && archived[0].completedAt) {
            const firstMonth = new Date(archived[0].completedAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
            setOpenMonth(firstMonth);
        }
      };
      fetchArchived();
    }
  }, [isOpen]);

  const groupedTasks = archivedTasks.reduce((acc, task) => {
    if (!task.completedAt) return acc;
    const monthYear = new Date(task.completedAt).toLocaleDateString('tr-TR', {
      month: 'long',
      year: 'numeric',
    });
    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
  
  const toggleMonth = (month: string) => {
    setOpenMonth(openMonth === month ? null : month);
  };

  const handleUnarchive = async (taskToUnarchive: Task) => {
    await unarchiveTask(taskToUnarchive.id);
    setArchivedTasks(prevTasks => prevTasks.filter(t => t.id !== taskToUnarchive.id));
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Arşivlenmiş Görevler" className="max-w-3xl">
      <div className="min-h-[60vh]">
        {loading ? (
          <p className="text-center text-gray-500">Arşiv yükleniyor...</p>
        ) : Object.keys(groupedTasks).length > 0 ? (
          <div className="space-y-3">
            {Object.keys(groupedTasks).map((monthYear) => {
              const tasks = groupedTasks[monthYear];
              return (
                <div key={monthYear} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex justify-between items-center p-4 text-left font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100"
                    onClick={() => toggleMonth(monthYear)}
                  >
                    <span>{monthYear} <span className="text-gray-500 font-normal">({tasks.length} görev)</span></span>
                    <svg className={`w-5 h-5 transition-transform ${openMonth === monthYear ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openMonth === monthYear && (
                    <div className="p-4 border-t border-gray-200 bg-white">
                      <ul className="space-y-3">
                        {tasks.map(task => {
                          const responsible = getMemberById(task.responsibleId);
                          return (
                            <li key={task.id} className="p-3 bg-white rounded-md border border-gray-200 flex items-center justify-between gap-4">
                              <div className="flex-grow">
                                  <p className="font-medium text-gray-800">{task.title}</p>
                                  <p className="text-sm text-gray-500 mt-1">
                                      Tamamlandı: {formatDateTime(task.completedAt)}
                                  </p>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                  {responsible && <Avatar member={responsible} size="md" responsible />}
                                   <button 
                                      onClick={() => handleUnarchive(task)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                                      title="Görevi arşive geri taşı"
                                  >
                                      <UndoIcon className="w-4 h-4" />
                                      <span>Geri Al</span>
                                  </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-500 pt-10">Arşivlenmiş görev bulunmuyor.</p>
        )}
      </div>
    </Modal>
  );
};

export default ArchiveModal;
