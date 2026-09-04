import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 sm:left-4 sm:translate-x-0 z-[100] flex items-center gap-2 rounded-xl bg-gray-900 border border-gray-700 px-4 py-2 text-sm font-medium text-white shadow-lg animate-in slide-in-from-bottom-5">
      <WifiOff className="w-4 h-4 text-gray-300" />
      <span>Mode Luring</span>
      <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse ml-2" />
    </div>
  );
};
