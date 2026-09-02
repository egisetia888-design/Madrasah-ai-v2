import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { useUIStore } from '../../store/uiStore';
import { Keyboard, Command, ArrowUp, CornerDownLeft, Search, Zap, Save, HelpCircle, X } from 'lucide-react';

export function ShortcutGuide() {
  const open = useUIStore(state => state.shortcutGuideOpen);
  const setOpen = useUIStore(state => state.setShortcutGuideOpen);

  const shortcuts = [
    { 
      group: "Navigasi & Pencarian",
      items: [
        { keys: ["Cmd", "K"], description: "Buka Palet Perintah / Pencarian", icon: Search },
        { keys: ["/"], description: "Fokus ke pencarian (saat di halaman tertentu)", icon: Search },
        { keys: ["Esc"], description: "Tutup dialog atau batalkan aksi", icon: X },
      ]
    },
    { 
      group: "Input & Kreasi",
      items: [
        { keys: ["Cmd", "Shift", "I"], description: "Tangkapan Kilat (Quick Add)", icon: Zap },
        { keys: ["Cmd", "S"], description: "Simpan Catatan atau Draf", icon: Save },
        { keys: ["Cmd", "Enter"], description: "Kirim atau Simpan (dalam dialog)", icon: CornerDownLeft },
      ]
    },
    { 
      group: "Bantuan",
      items: [
        { keys: ["?"], description: "Buka Panduan Pintasan Ini", icon: HelpCircle },
      ]
    }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-2xl">
        <DialogHeader className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-gray-900 font-display">
            <Keyboard className="w-5 h-5 text-gray-900" />
            Panduan Pintasan Papan Ketik
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
          {shortcuts.map((group, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">
                {group.group}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100 hover:border-gray-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{item.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-gray-500 bg-white border border-gray-200 rounded shadow-sm">
                            {key === "Cmd" ? <Command className="w-2.5 h-2.5" /> : key === "Shift" ? <ArrowUp className="w-2.5 h-2.5" /> : key}
                          </kbd>
                          {keyIdx < item.keys.length - 1 && <span className="text-[10px] text-gray-300">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] text-gray-500 font-medium text-center italic">
            Tips: Gunakan pintasan untuk meningkatkan alur kerja "Madrasah" Anda.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
