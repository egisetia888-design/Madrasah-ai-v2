import React, { useState } from 'react';
import { Globe, Key, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Draft } from '../../types';
import { usePublishingStore } from '../../store/publishingStore';
import { useToastStore } from '../../store/toastStore';
import { useWritingStore } from '../../store/writingStore';

interface PublishWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: Draft;
}

export function PublishWebhookModal({ isOpen, onClose, draft }: PublishWebhookModalProps) {
  const { webhookUrl, webhookSecret, serviceName, setPublishingSettings } = usePublishingStore();
  const [urlInput, setUrlInput] = useState(webhookUrl);
  const [secretInput, setSecretInput] = useState(webhookSecret);
  const [serviceNameInput, setServiceNameInput] = useState(serviceName || 'Layanan Penerbitan Mandiri');
  const [isPublishing, setIsPublishing] = useState(false);
  const [markAsPublished, setMarkAsPublished] = useState(true);

  const addToast = useToastStore((state) => state.addToast);
  const updateToast = useToastStore((state) => state.updateToast);
  const updateDraft = useWritingStore((state) => state.updateDraft);

  const wordCount = draft.content.split(/\s+/).filter((w) => w.length > 0).length;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      addToast({ type: 'error', message: 'Target Webhook URL wajib diisi.' });
      return;
    }

    try {
      new URL(cleanUrl);
    } catch {
      addToast({ type: 'error', message: 'Format Webhook URL tidak valid (harus diawali http:// atau https://).' });
      return;
    }

    // Persist latest settings
    setPublishingSettings({
      webhookUrl: cleanUrl,
      webhookSecret: secretInput.trim(),
      serviceName: serviceNameInput.trim(),
    });

    setIsPublishing(true);
    const toastId = addToast({ type: 'loading', message: `Mengirim tulisan ke ${serviceNameInput || 'webhook'}...` });

    const payload = {
      event: 'post.publish',
      article: {
        id: draft.id,
        title: draft.title || 'Tanpa Judul',
        content: draft.content,
        excerpt: draft.content.substring(0, 200).replace(/[\r\n]+/g, ' ').trim(),
        tags: draft.tags || [],
        wordCount,
        status: markAsPublished ? 'published' : draft.status,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date(draft.updatedAt).toISOString(),
        createdAt: new Date(draft.createdAt).toISOString(),
      },
      source: 'Madrasah Personal Knowledge OS',
    };

    try {
      const response = await fetch('/api/publishing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: cleanUrl,
          secret: secretInput.trim() || undefined,
          payload,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (markAsPublished && draft.status !== 'published') {
          updateDraft(draft.id, { status: 'published' });
        }
        updateToast(toastId, {
          type: 'success',
          message: `Tulisan berhasil diterbitkan ke ${serviceNameInput || 'webhook'} (HTTP ${result.status}).`,
        });
        onClose();
      } else {
        updateToast(toastId, {
          type: 'error',
          message: result.error || 'Gagal menerbitkan tulisan via webhook.',
        });
      }
    } catch (err: any) {
      console.error('Publishing request error:', err);
      updateToast(toastId, {
        type: 'error',
        message: err?.message || 'Terjadi gangguan koneksi ke server.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} maxWidthClass="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-gray-900 flex items-center gap-2 font-display">
          <Globe className="w-5 h-5 text-gray-500" />
          Penerbitan Pihak Ketiga via Webhook
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handlePublish} className="space-y-5 py-4">
        {/* Ringkasan Draf yang Akan Dikirim */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
            <span>DRAF TULISAN</span>
            <span>{wordCount} KATA</span>
          </div>
          <h4 className="font-semibold text-gray-900 text-base">{draft.title || 'Tanpa Judul'}</h4>
          <p className="text-xs text-gray-600 line-clamp-2">
            {draft.content.substring(0, 160)}...
          </p>
          {draft.tags && draft.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {draft.tags.map((t) => (
                <span key={t} className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Konfigurasi Webhook */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Nama Platform / Layanan
            </label>
            <input
              type="text"
              value={serviceNameInput}
              onChange={(e) => setServiceNameInput(e.target.value)}
              placeholder="Contoh: Ghost CMS, Hugo Repo, Medium API"
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              Endpoint Webhook URL <span className="text-gray-400 font-normal">(Wajib)</span>
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://api.yourdomain.com/hooks/publish"
                className="w-full text-sm font-mono bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Server Madrasah akan mengirimkan payload JSON artikel (`title`, `content`, `tags`, `wordCount`) ke URL ini via HTTP POST.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
              API Token / Secret Webhook <span className="text-gray-400 font-normal">(Opsional)</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="Bearer token atau secret key jika diwajibkan oleh platform tujuan"
                className="w-full text-sm font-mono bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="markAsPublished"
              checked={markAsPublished}
              onChange={(e) => setMarkAsPublished(e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <label htmlFor="markAsPublished" className="text-xs text-gray-700 cursor-pointer">
              Perbarui status draf di Studio Menulis menjadi <strong>Terbit</strong> (Published) saat pengiriman sukses.
            </label>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPublishing}>
            Batal
          </Button>
          <Button type="submit" disabled={isPublishing} className="gap-2 bg-gray-900 hover:bg-gray-800 text-white min-h-[44px] md:min-h-[36px]">
            {isPublishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Menerbitkan...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Kirim ke Webhook
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
