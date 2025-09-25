import React, 'react';
// FIX: Corrected import for KanbanProvider as the file was missing content.
import { KanbanProvider } from './context/KanbanContext';
import Board from './components/Board';
import Header from './components/Header';
import { Toaster } from './components/ui/Toaster';
import AdminPanelModal from './components/AdminPanelModal';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
// FIX: Corrected import for UserSignIn as the file was missing content.
import UserSignIn from './components/UserSignIn';
import { useKanbanStore } from './hooks/useKanbanStore';

const FirestoreErrorScreen: React.FC<{ error: Error }> = ({ error }) => {
  const projectId = "thf-wflow-app";
  const firestoreUrl = `https://console.firebase.google.com/project/${projectId}/firestore`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 ring-1 ring-red-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Veritabanı Bağlantı Hatası</h2>
          <p className="mt-2 text-md text-gray-600">
            Uygulama, Cloud Firestore veritabanına bağlanamadı. Bunun en yaygın nedeni, Firebase projenizde veritabanının etkinleştirilmemiş olmasıdır.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Sorunu Çözmek İçin:</h3>
          <ol className="list-decimal list-inside space-y-3 text-gray-700">
            <li>
              Firebase projenizi açın: <a href={firestoreUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 font-medium hover:underline">Firestore Veritabanı Konsolu</a>
            </li>
            <li>
              Eğer istenirse, <span className="font-semibold">"Veritabanı oluştur"</span> düğmesine tıklayın.
            </li>
            <li>
              Kurulum sırasında <span className="font-semibold">"Test modunda başlat"</span> seçeneğini seçin. Bu, uygulamanın verileri okumasına ve yazmasına izin verir.
            </li>
            <li>
              Bu adımları tamamladıktan sonra, <button onClick={() => window.location.reload()} className="text-sky-600 font-medium hover:underline">sayfayı yenileyin</button>.
            </li>
          </ol>
        </div>
         <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 overflow-auto max-h-24">
            <p className="font-mono">Hata Detayı: {error.message}</p>
        </div>
      </div>
    </div>
  );
};


const AuthGate: React.FC = () => {
  const { currentUser, loading, firestoreError } = useKanbanStore();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = React.useState(false);

  if (firestoreError) {
    return <FirestoreErrorScreen error={firestoreError} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>Uygulama yükleniyor...</p>
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