import React from 'react';
import { Cloud, CloudOff, RefreshCw, HardDrive, AlertCircle } from 'lucide-react';
import { useSyncStateStore } from '../../store/syncStateStore';
import { useNavigate } from 'react-router-dom';

interface GlobalSyncBadgeProps {
  className?: string;
  compact?: boolean;
}

export function GlobalSyncBadge({ className = '', compact = false }: GlobalSyncBadgeProps) {
  const status = useSyncStateStore((state) => state.status);
  const lastSyncedAt = useSyncStateStore((state) => state.lastSyncedAt);
  const navigate = useNavigate();

  const getRelativeTime = (time: number | null) => {
    if (!time) return null;
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 30) return 'baru saja';
    if (diff < 60) return `${diff}d lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
    return `${Math.floor(diff / 3600)}j lalu`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/settings');
  };

  if (status === 'syncing') {
    return (
      <button
        onClick={handleClick}
        title="Sedang menyinkronkan perubahan ke Cloud"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200 ${className}`}
      >
        <RefreshCw className="w-3 h-3 animate-spin text-gray-700" />
        {!compact && <span>Sinkronisasi...</span>}
      </button>
    );
  }

  if (status === 'offline') {
    return (
      <button
        onClick={handleClick}
        title="Perangkat sedang offline — data aman tersimpan secara lokal"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200 ${className}`}
      >
        <CloudOff className="w-3 h-3 text-gray-500" />
        {!compact && <span>Offline</span>}
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button
        onClick={handleClick}
        title="Terjadi kendala saat menyinkronkan data. Klik untuk buka Pengaturan"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-800 bg-gray-200 hover:bg-gray-300 transition-colors border border-gray-300 ${className}`}
      >
        <AlertCircle className="w-3 h-3 text-gray-800" />
        {!compact && <span>Kendala Cloud</span>}
      </button>
    );
  }

  if (status === 'synced') {
    const timeText = getRelativeTime(lastSyncedAt);
    return (
      <button
        onClick={handleClick}
        title={`Tersinkronisasi ke Cloud${timeText ? ` (${timeText})` : ''}. Klik untuk buka Pengaturan`}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200 ${className}`}
      >
        <Cloud className="w-3 h-3 text-gray-700" />
        {!compact && <span>Tersinkron{timeText ? ` · ${timeText}` : ''}</span>}
      </button>
    );
  }

  // local_only
  return (
    <button
      onClick={handleClick}
      title="Tersimpan lokal di peramban ini. Hubungkan akun di Pengaturan untuk sinkronisasi multi-device."
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 ${className}`}
    >
      <HardDrive className="w-3 h-3 text-gray-500" />
      {!compact && <span>Lokal</span>}
    </button>
  );
}
