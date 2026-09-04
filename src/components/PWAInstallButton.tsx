import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Button';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <Button
        onClick={install}
        variant="outline"
        size="sm"
        className="flex items-center gap-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Install App</span>
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          onClick={() => setShowIOSGuide(true)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 rounded-lg text-gray-700 border-gray-200"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Install App</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative">
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-4">
                <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center shadow-sm mx-auto">
                  <Download className="w-6 h-6 text-gray-700" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold font-display text-gray-900 text-center mb-2">Install Madrasah di iOS</h3>
              <p className="mt-2 text-sm text-gray-600 font-sans text-center mb-6 leading-relaxed">
                Aplikasi ini dapat diinstal agar terasa lebih cepat dan tampil penuh di layar Anda.
              </p>
              
              <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 text-xs font-bold">1</div>
                  <p className="text-sm text-gray-700">Tekan tombol <strong>Share</strong> (ikon kotak dengan panah atas) di bar navigasi Safari.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 text-xs font-bold">2</div>
                  <p className="text-sm text-gray-700">Gulir ke bawah dan pilih <strong>Add to Home Screen</strong> (Tambahkan ke Layar Utama).</p>
                </div>
              </div>
              
              <Button
                onClick={() => setShowIOSGuide(false)}
                className="w-full h-11 bg-gray-900 text-white rounded-xl hover:bg-gray-800"
              >
                Tutup Panduan
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
