import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-stone-900 border border-stone-800 px-4 py-2.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-bounce">
      <WifiOff className="w-4 h-4 text-[#86efac]" />
      <span>Offline Mode — Using local cached Indian tenders & BOQ calculations.</span>
    </div>
  );
};
