import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { SyncStatus } from '../../types';

interface SyncStatusIndicatorProps {
  status?: SyncStatus;
}

export function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  if (!status) return null;

  switch (status) {
    case 'synced':
      return (
        <div className="flex items-center" title="Tersinkron ke cloud">
          <Cloud className="w-3.5 h-3.5 text-gray-400" />
        </div>
      );
    case 'local_only':
      return (
        <div className="flex items-center" title="Tersimpan lokal">
          <CloudOff className="w-3.5 h-3.5 text-gray-400" />
        </div>
      );
    case 'pending_sync':
    case 'syncing':
      return (
        <div className="flex items-center" title="Menunggu sinkronisasi">
          <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
        </div>
      );
    case 'conflict':
      return (
        <div className="flex items-center" title="Konflik terdeteksi — ketuk untuk selesaikan">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-900" />
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center" title="Gagal sinkronisasi">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-900" />
        </div>
      );
    default:
      return null;
  }
}
