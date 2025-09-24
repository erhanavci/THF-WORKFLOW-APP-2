import React, { useState, useEffect } from 'react';

const LiveIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isSupported = 'BroadcastChannel' in window;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatus = (): { color: string; text: string } => {
    if (!isOnline) {
      return { color: 'bg-red-500', text: 'Çevrimdışı' };
    }
    if (isSupported) {
      return { color: 'bg-green-500', text: 'Canlı' };
    }
    return { color: 'bg-yellow-500', text: 'Canlı Senkronizasyon Sınırlı' };
  };

  const status = getStatus();

  return (
    <div className="flex items-center gap-2 group relative">
      <div className={`w-3 h-3 rounded-full ${status.color} ring-2 ring-white`}></div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        {status.text}
      </div>
    </div>
  );
};

export default LiveIndicator;
