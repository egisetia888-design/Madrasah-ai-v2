import React from 'react';
import { Dialog, DialogContent } from '../ui/Dialog';
import { useUIStore } from '../../store/uiStore';
import { Brain, Heart, Globe, Github } from 'lucide-react';
import { motion } from 'motion/react';

export function AboutDialog() {
  const open = useUIStore(state => state.aboutOpen);
  const setOpen = useUIStore(state => state.setAboutOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white rounded-[2rem] border border-gray-100 shadow-2xl">
        <div className="relative p-8 flex flex-col items-center text-center space-y-6">
          {/* Decorative background element */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-gray-50/50 to-transparent -z-10" />
          
          {/* Logo Section */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-gray-900 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-gray-200"
          >
            <Brain className="w-10 h-10 text-white" />
          </motion.div>

          {/* App Info */}
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-gray-900 tracking-tight">
              Madrasah
            </h2>
            <p className="text-[11px] font-mono text-gray-400 uppercase tracking-[0.2em]">
              Personal Knowledge OS
            </p>
          </div>

          {/* Version & Author */}
          <div className="w-full grid grid-cols-2 gap-4 py-4 border-y border-gray-50">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-medium mb-1">Versi</p>
              <p className="text-sm font-semibold text-gray-900">v1.0.0-beta</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-medium mb-1">Kreator</p>
              <p className="text-sm font-semibold text-gray-900">egiistw88</p>
            </div>
          </div>

          {/* Quote Section */}
          <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100/50 relative group transition-all hover:bg-gray-50">
            <p className="text-sm font-medium text-gray-700 leading-relaxed italic">
              "Tuntutlah ilmu dari buaian hingga ke liang lahat."
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              <Globe className="w-3 h-3" />
              Hadits Riwayat
            </div>
          </div>

          {/* Footer Social/Links */}
          <div className="flex items-center gap-6 pt-2">
            <button className="text-gray-400 hover:text-gray-900 transition-colors">
              <Github className="w-5 h-5" />
            </button>
            <button className="text-gray-400 hover:text-gray-900 transition-colors">
              <Heart className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[10px] text-gray-300 font-medium">
            © {new Date().getFullYear()} Madrasah OS. All rights reserved.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
