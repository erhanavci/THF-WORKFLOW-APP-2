import React, { useState } from 'react';
// FIX: Corrected import for KanbanProvider as the file was missing content.
import { KanbanProvider } from './context/KanbanContext';
import Board from './components/Board';
import Header from './components/Header';
import { Toaster } from './components/ui/Toaster';
import AdminPanelModal from './components/AdminPanelModal';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useKanbanStore } from './hooks/useKanbanStore';
// FIX: Corrected import for UserSignIn as the file was missing content.
import UserSignIn from './components/UserSignIn';

const AuthGate: React.FC = () => {
  const { currentUser, authLoading } = useKanbanStore();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>Oturum durumu kontrol ediliyor...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <UserSignIn />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header onAdminPanelClick={() => setIsAdminPanelOpen(true)} />
      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <Board />
      </main>
      <Toaster />
      {isAdminPanelOpen && <AdminPanelModal onClose={() => setIsAdminPanelOpen(false)} />}
    </div>
  );
};


const App: React.FC = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <KanbanProvider>
          <AuthGate />
      </KanbanProvider>
    </DndProvider>
  );
};

export default App;