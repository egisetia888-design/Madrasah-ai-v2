import { fetchWithAuth } from '../../lib/api';
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Save, Trash2, Send, ChevronDown, Sparkles, Check, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { ContextualSidebar } from "../../components/writing/ContextualSidebar";
import { useWritingStore } from "../../store/writingStore";
import { useNotesStore } from "../../store/notesStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { WritingStatus } from "../../types";
import { useToastStore } from "../../store/toastStore";
import { scanTextForEntities, autoLinkSingleEntity } from "../../utils/autoLinker";

const WRITING_PIPELINE: { id: WritingStatus; label: string }[] = [
  { id: 'idea', label: 'Ide' },
  { id: 'outline', label: 'Kerangka' },
  { id: 'draft', label: 'Draf' },
  { id: 'editing', label: 'Penyuntingan' },
  { id: 'review', label: 'Ulasan' },
  { id: 'published', label: 'Diterbitkan' }
];

export function WritingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const drafts = useWritingStore(state => state.drafts);
  const updateDraft = useWritingStore(state => state.updateDraft);
  const deleteDraft = useWritingStore(state => state.deleteDraft);
  const addToast = useToastStore(state => state.addToast);
  const updateToast = useToastStore(state => state.updateToast);
  
  const draft = drafts.find(d => d.id === id);
  
  const [title, setTitle] = useState(draft?.title || "");
  const [content, setContent] = useState(draft?.content || "");
  const [status, setStatus] = useState<WritingStatus>(draft?.status || 'idea');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ tags: string[], icon: string } | null>(null);

  const addTag = useNotesStore(state => state.addTag);
  const notes = useNotesStore(state => state.notes);

  useEffect(() => {
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
      setStatus(draft.status as WritingStatus);
    }
  }, [draft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, content, status, draft?.id]);

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-medium text-gray-900">Draf tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/writing")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Penulisan
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    setIsSaving(true);
    updateDraft(draft.id, { title, content, status });
    
    // Auto-link any detected entities in draft
    try {
      autoLinkSingleEntity(draft.id, `${title}\n${content}`, 'writing', title || 'Draf');
    } catch (e) {
      console.warn('Draft auto-link warning:', e);
    }

    // Index for semantic search
    useWritingStore.getState().indexDraft(draft.id);
    
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleAnalyzeContent = async () => {
    setIsAnalyzing(true);
    setAiSuggestions(null);
    const toastId = addToast({ type: 'loading', message: 'AI sedang menganalisis draf tulisan...' });

    try {
      const res = await fetchWithAuth("/api/ai/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: title + "\n\n" + content,
          notes: notes
        }),
      });
      const data = await res.json();
      if (res.ok && (data.tags || data.icon)) {
        setAiSuggestions({
          tags: data.tags || [],
          icon: data.icon || "PenTool"
        });
        updateToast(toastId, { type: 'success', message: 'Analisis AI selesai.' });
      } else {
        updateToast(toastId, { type: 'error', message: data.error || "Gagal menganalisis draf tulisan dengan AI." });
      }
    } catch (err: any) {
      console.error("Analysis failed:", err);
      updateToast(toastId, { type: 'error', message: "Gagal menghubungkan ke layanan AI." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const approveSuggestions = () => {
    if (!aiSuggestions) return;
    
    updateDraft(draft.id, { 
      icon: aiSuggestions.icon,
      tags: [...(draft.tags || []), ...aiSuggestions.tags]
    });
    setAiSuggestions(null);
  };

  const discardSuggestions = () => {
    setAiSuggestions(null);
  };

  const handleDelete = () => {
    deleteDraft(draft.id);
    navigate("/writing");
  };

  return (
    <div className="flex h-full animate-in fade-in duration-500">
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate("/writing")}>
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Button>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="gap-2 text-gray-900 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300" 
                onClick={handleAnalyzeContent}
                disabled={isAnalyzing}
              >
                <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{isAnalyzing ? "Menganalisis..." : "Analisis Draf"}</span>
              </Button>
              <Button variant="ghost" className="gap-2 text-gray-900 hover:text-gray-800 hover:bg-gray-50" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Hapus</span>
              </Button>
              <div className="relative group">
                <select 
                  value={status}
                  onChange={(e) => {
                     setStatus(e.target.value as WritingStatus);
                     updateDraft(draft.id, { status: e.target.value as WritingStatus });
                  }}
                  className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer"
                >
                  {WRITING_PIPELINE.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
              </div>
              <Button onClick={handleSave} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{isSaving ? "Tersimpan!" : "Simpan Draf"}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {aiSuggestions && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2 animate-in slide-in-from-top duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gray-900" />
                    <h3 className="text-sm font-semibold text-gray-900 font-display">Saran AI (Draf)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={discardSuggestions} className="h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100">Tolak</Button>
                    <Button size="sm" onClick={approveSuggestions} className="h-8 bg-gray-900 hover:bg-gray-800 text-white gap-1">
                      <Check className="w-3 h-3" /> Terima Saran
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider font-mono">Ikon:</span>
                    {(() => {
                      const Icon = (LucideIcons as any)[aiSuggestions.icon] || LucideIcons.FileText;
                      return <Icon className="w-4 h-4 text-gray-900" />;
                    })()}
                    <span className="text-xs font-medium text-gray-900">{aiSuggestions.icon}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mr-1 font-mono">Tag:</span>
                    {aiSuggestions.tags.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] font-bold bg-white text-gray-800 rounded-lg border border-gray-200 tracking-wide uppercase">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              {draft.icon && (
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  {(() => {
                     const Icon = (LucideIcons as any)[draft.icon] || LucideIcons.FileText;
                     return <Icon className="w-8 h-8 text-gray-900" />;
                  })()}
                </div>
              )}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-4xl font-bold tracking-tight text-gray-900 bg-transparent border-none outline-none w-full placeholder:text-gray-300 focus:ring-0 p-0 font-serif"
                placeholder="Judul Dokumen"
              />
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 border-y border-gray-100 py-3">
              <span>{content.split(/\s+/).filter(w => w.length > 0).length} kata</span>
              <span>Terakhir disunting: {new Date(draft.updatedAt).toLocaleTimeString()}</span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[600px] text-lg leading-relaxed text-gray-800 bg-transparent border-none outline-none resize-none placeholder:text-gray-300 focus:ring-0 p-0 font-serif"
              placeholder="Mulai menulis draf Anda..."
            />
          </div>
        </div>
      </div>

      <ContextualSidebar 
        title={title} 
        content={content} 
        currentDraftId={draft.id} 
        onInsertWikilink={(linkTitle) => {
          setContent(prev => `${prev} [[${linkTitle}]] `);
        }}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogHeader>
          <DialogTitle>Hapus Draf</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-gray-600">Apakah Anda yakin ingin menghapus "{draft.title}"? Tindakan ini tidak dapat dibatalkan.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
          <Button variant="destructive" onClick={handleDelete} className="bg-gray-900 hover:bg-gray-800 text-white">Hapus Draf</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
