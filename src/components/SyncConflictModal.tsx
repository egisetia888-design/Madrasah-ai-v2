import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { SyncMetadata } from '../types';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  localData: any & SyncMetadata;
  onResolveLocal: () => void;
  onResolveRemote: () => void;
}

export function SyncConflictModal({ isOpen, onClose, entityName, localData, onResolveLocal, onResolveRemote }: SyncConflictModalProps) {
  if (!localData || !localData.conflict) return null;
  const { remoteData, localRevision, remoteRevision } = localData.conflict;

  return (
    <Dialog open={isOpen} onOpenChange={onClose} maxWidthClass="max-w-4xl">
      <DialogHeader>
        <DialogTitle className="text-gray-900 flex items-center gap-2">
          Konflik Sinkronisasi: {entityName}
        </DialogTitle>
      </DialogHeader>
      
      <div className="py-4 space-y-4 text-gray-700">
        <p>Sistem mendeteksi adanya perubahan dari perangkat lain yang bertentangan dengan perubahan lokal Anda.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 bg-gray-50 p-4 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-2">Versi Cloud (Revisi {remoteRevision})</h4>
            <div className="text-sm font-mono overflow-auto max-h-60 bg-white p-2 rounded border border-gray-200">
              {JSON.stringify(remoteData, null, 2)}
            </div>
            <Button onClick={onResolveRemote} variant="outline" className="mt-4 w-full text-gray-900 border-gray-300 hover:bg-gray-100">
              Gunakan Versi Cloud
            </Button>
          </div>
          
          <div className="border border-gray-900/30 bg-gray-100 p-4 rounded-xl">
            <h4 className="font-semibold text-gray-900 mb-2">Versi Lokal Anda (Revisi {localRevision})</h4>
            <div className="text-sm font-mono overflow-auto max-h-60 bg-white p-2 rounded border border-gray-200">
              {JSON.stringify(localData, (key, val) => key === 'conflict' ? undefined : val, 2)}
            </div>
            <Button onClick={onResolveLocal} className="mt-4 w-full bg-gray-900 hover:bg-gray-800 text-white">
              Gunakan Versi Lokal
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
