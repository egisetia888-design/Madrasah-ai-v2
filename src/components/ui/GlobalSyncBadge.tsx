import React from 'react';
import { HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import { useSyncStateStore } from '../../store/syncStateStore';
import { useNavigate } from 'react-router-dom';

interface GlobalSyncBadgeProps {
  className?: string;
  compact?: boolean;
}

export function GlobalSyncBadge({ className = '', compact = false }: GlobalSyncBadgeProps) {
  const status = useSyncStateStore((state) => state.status);
  const lastSavedAt = useSyncStateStore((state) => state.lastSavedAt);
  const errorMessage = useSyncStateStore((state) => state.errorMessage);
  const navigate = useNavigate();

  const getRelativeTime = (time: number | null) => {
    if (!time) return null;
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 30) return 'baru saja';
    if (diff < 60) return `${diff}d lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
    return `${Math.floor(diff / 86400)}h lalu`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/settings');
  };

  if (status === 'saving') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="Sedang menyimpan perubahan ke penyimpanan lokal IndexedDB"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200 whitespace-nowrap shrink-0 ${className}`}
      >
        <RefreshCw className="w-3 h-3 animate-spin text-gray-700" />
        {!compact && <span>Menyimpan...</span>}
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={errorMessage || 'Terjadi kendala penyimpanan lokal. Klik untuk buka Pengaturan.'}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-800 bg-gray-200 hover:bg-gray-300 transition-colors border border-gray-300 whitespace-nowrap shrink-0 ${className}`}
      >
        <AlertCircle className="w-3 h-3 text-gray-800" />
        {!compact && <span>Peringatan Lokal</span>}
      </button>
    );
  }

  const timeText = getRelativeTime(lastSavedAt);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Penyimpanan Lokal IndexedDB aktif${timeText ? ` (disimpan ${timeText})` : ''}. Klik untuk kelola cadangan di Pengaturan.`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 whitespace-nowrap shrink-0 ${className}`}
    >
      <HardDrive className="w-3 h-3 text-gray-500" />
      {!compact && <span>Lokal{timeText ? ` · ${timeText}` : ''}</span>}
    </button>
  );
}
