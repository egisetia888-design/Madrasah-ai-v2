import React from 'react';
import { HardDrive } from 'lucide-react';
import { SyncStatus } from '../../types';

interface SyncStatusIndicatorProps {
  status?: SyncStatus;
}

export function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  if (!status) return null;

  return (
    <div className="flex items-center" title="Tersimpan lokal di perangkat (IndexedDB)">
      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
    </div>
  );
}
