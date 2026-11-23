import React from 'react';
import { Dialog, DialogContent } from '../ui/Dialog';
import { useUIStore } from '../../store/uiStore';
import { Brain, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export function AboutDialog() {
  const open = useUIStore(state => state.aboutOpen);
  const setOpen = useUIStore(state => state.setAboutOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen} maxWidthClass="max-w-sm">
      <DialogContent className="p-0 overflow-hidden bg-white">
        <div className="relative p-7 flex flex-col items-center text-center space-y-5">
          {/* Logo Section */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center shadow-sm"
          >
            <Brain className="w-8 h-8 text-white" />
          </motion.div>

          {/* App Info */}
          <div className="space-y-1.5">
            <h2 className="text-xl font-display font-bold text-gray-900 tracking-tight">
              Madrasah
            </h2>
            <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.18em]">
              Sistem Operasi Pengetahuan Pribadi
            </p>
          </div>

          {/* Version & Author */}
          <div className="w-full grid grid-cols-2 gap-4 py-4 border-y border-gray-100">
            <div className="text-center">
              <p className="text-[11px] text-gray-400 font-medium mb-1">Versi</p>
              <p className="text-sm font-semibold text-gray-900 font-mono tabular-nums">v1.2.5</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-gray-400 font-medium mb-1">Kreator</p>
              <p className="text-sm font-semibold text-gray-900">Egi Setia</p>
            </div>
          </div>

          {/* Quote Section */}
          <div className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <p className="text-sm font-medium text-gray-700 leading-relaxed italic font-serif">
              "Tuntutlah ilmu dari buaian hingga ke liang lahat."
            </p>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-mono uppercase tracking-widest">
              <Globe className="w-3 h-3" />
              Hadits Riwayat
            </div>
          </div>

          <p className="text-[11px] text-gray-400 font-mono">
            © {new Date().getFullYear()} Madrasah · Penyimpanan Lokal IndexedDB
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
