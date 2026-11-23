import { fetchWithAuth, prepareContentExcerpt, prepareSuggestTagsPayload } from '../../lib/api';
import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Save, Trash2, Eye, PenTool, ChevronDown, BrainCircuit, CheckCircle2, Folder, Tag as TagIcon, X, Sparkles, Check, Plus, Loader2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useNotesStore } from "../../store/notesStore";
import { useReviewStore } from "../../store/reviewStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { MetadataRow } from "../../components/ui/MetadataRow";
import { ProvenanceBadge } from "../../components/ui/ProvenanceBadge";
import { ReliabilityBadge, RELIABILITY_LEVELS } from "../../components/ui/ReliabilityBadge";
import { NoteStatus, NoteType, EpistemicDomain } from "../../types";
import { MarkdownRenderer } from "../../components/ui/MarkdownRenderer";
import { useToastStore } from "../../store/toastStore";

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const notes = useNotesStore(state => state.notes);
  const folders = useNotesStore(state => state.folders);
  const allTags = useNotesStore(state => state.tags);
  const updateNote = useNotesStore(state => state.updateNote);
  const deleteNote = useNotesStore(state => state.deleteNote);
  const addTag = useNotesStore(state => state.addTag);
  const books = useLibraryStore(state => state.books);
  
  const concepts = useKnowledgeStore(state => state.concepts);
  const sourceFragments = useKnowledgeStore(state => state.sourceFragments);
  const relations = useKnowledgeStore(state => state.relations);
  const addRelation = useKnowledgeStore(state => state.addRelation);
  const deleteRelation = useKnowledgeStore(state => state.deleteRelation);
  const addSourceFragment = useKnowledgeStore(state => state.addSourceFragment);
  
  const decks = useReviewStore(state => state.decks);
  const addFlashcard = useReviewStore(state => state.addFlashcard);
  
  const addToast = useToastStore(state => state.addToast);
  const updateToast = useToastStore(state => state.updateToast);
  
  const note = notes.find(n => n.id === id);
  
  const noteRelations = useMemo(() => {
    if (!note) return [];
    return relations.filter(r => r.sourceNodeId === note.id);
  }, [relations, note]);
  
  const linkedFragments = useMemo(() => {
    return noteRelations
      .filter(r => r.relationType === 'references')
      .map(r => ({
         relation: r,
         fragment: sourceFragments.find(f => f.id === r.targetNodeId)
      }))
      .filter(item => item.fragment);
  }, [noteRelations, sourceFragments]);
  
  const linkedConcepts = useMemo(() => {
    return noteRelations
      .filter(r => r.relationType === 'expands_on' || r.relationType === 'supports' || r.relationType === 'contradicts')
      .map(r => ({
         relation: r,
         concept: concepts.find(c => c.id === r.targetNodeId)
      }))
      .filter(item => item.concept);
  }, [noteRelations, concepts]);

  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [rawQuote, setRawQuote] = useState(note?.rawQuote || "");
  const [referenceCitation, setReferenceCitation] = useState(note?.referenceCitation || "");
  const [type, setType] = useState<NoteType>(note?.type || 'knowledge');
  const [status, setStatus] = useState<NoteStatus>(note?.status || 'unprocessed');
  const [folderId, setFolderId] = useState<string | null>(note?.folderId || null);
  const [noteTags, setNoteTags] = useState<string[]>(note?.tags || []);
  const [epistemicDomain, setEpistemicDomain] = useState<EpistemicDomain | "">(note?.epistemicDomain || "");
  
  const [tagInput, setTagInput] = useState("");
  const [isTagging, setIsTagging] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [quoteValidationError, setQuoteValidationError] = useState<string | null>(null);
  const rawQuoteRef = useRef<HTMLTextAreaElement>(null);
  const citationRef = useRef<HTMLTextAreaElement>(null);
  
  const sourceBook = note?.sourceId ? books.find(b => b.id === note.sourceId) : null;
  
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<Array<{front: string, back: string}>>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isSaved, setIsSaved] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLinkConceptOpen, setIsLinkConceptOpen] = useState(false);
  const [isLinkFragmentOpen, setIsLinkFragmentOpen] = useState(false);
  
  // Link states
  const [selectedConcept, setSelectedConcept] = useState<string>("");
  const [selectedFragment, setSelectedFragment] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("references");

  // New fragment creation state
  const [fragmentTab, setFragmentTab] = useState<'create' | 'existing'>('create');
  const [newFragmentQuote, setNewFragmentQuote] = useState<string>("");
  const [newFragmentLocation, setNewFragmentLocation] = useState<string>("");
  const [newFragmentReliability, setNewFragmentReliability] = useState<number>(1.0);

  const handleLinkConcept = () => {
    if (!selectedConcept) return;
    addRelation({
      sourceNodeId: note.id,
      targetNodeId: selectedConcept,
      relationType: relationType as any,
      confidenceScore: 1.0,
      createdBy: 'user',
      verifiedBySystem: true,
    });
    setIsLinkConceptOpen(false);
  };
  
  const handleLinkFragment = () => {
    if (!selectedFragment) return;
    addRelation({
      sourceNodeId: note.id,
      targetNodeId: selectedFragment,
      relationType: 'references',
      confidenceScore: 1.0,
      createdBy: 'user',
      verifiedBySystem: true,
    });
    setIsLinkFragmentOpen(false);
    setSelectedFragment("");
  };

  const handleCreateAndLinkFragment = () => {
    if (!newFragmentQuote.trim()) return;
    const fragmentId = addSourceFragment({
      sourceId: note.sourceId || null,
      quote: newFragmentQuote.trim(),
      location: newFragmentLocation.trim() || "Lokasi rujukan umum",
      reliabilityScore: newFragmentReliability,
    });
    addRelation({
      sourceNodeId: note.id,
      targetNodeId: fragmentId,
      relationType: 'references',
      confidenceScore: 1.0,
      createdBy: 'user',
      verifiedBySystem: true,
      explanation: 'Fragmen sumber ditautkan ke catatan',
    });
    setNewFragmentQuote("");
    setNewFragmentLocation("");
    setNewFragmentReliability(1.0);
    setIsLinkFragmentOpen(false);
  };
  const [aiSuggestions, setAiSuggestions] = useState<{ tags: string[], icon: string } | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setRawQuote(note.rawQuote || "");
      setReferenceCitation(note.referenceCitation || "");
      setType(note.type);
      setStatus(note.status);
      setFolderId(note.folderId);
      setNoteTags(note.tags);
      setEpistemicDomain(note.epistemicDomain || "");
    }
  }, [note]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, content, rawQuote, referenceCitation, type, status, folderId, noteTags, epistemicDomain, note?.id]);

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-900 font-display">Catatan tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/notes")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Catatan
        </Button>
      </div>
    );
  }

  const getRelationLabel = (relType: string) => {
    switch (relType) {
      case 'expands_on': return 'Mengembangkan';
      case 'supports': return 'Mendukung';
      case 'contradicts': return 'Bertentangan';
      case 'references': return 'Merujuk';
      default: return relType;
    }
  };

  const handleSave = () => {
    if ((rawQuote.trim() && !referenceCitation.trim()) || (!rawQuote.trim() && referenceCitation.trim())) {
      const msg = "Kutipan Mentah dan Sumber Referensi wajib diisi berpasangan untuk menjaga jejak epistemologis.";
      setQuoteValidationError(msg);
      addToast({ type: 'error', message: msg });
      if (!rawQuote.trim()) {
        rawQuoteRef.current?.focus();
      } else {
        citationRef.current?.focus();
      }
      return;
    }
    setQuoteValidationError(null);
    setIsSaving(true);
    updateNote(note.id, { 
      title, 
      content,
      rawQuote,
      referenceCitation, 
      type, 
      status, 
      folderId,
      tags: noteTags,
      epistemicDomain: epistemicDomain ? epistemicDomain as EpistemicDomain : undefined
    });
    
    // Index for semantic search
    useNotesStore.getState().indexNote(note.id);
    addToast({ type: 'success', message: 'Catatan tersimpan.' });
    
    setTimeout(() => setIsSaving(false), 500); 
  };

  const handleDelete = () => {
    deleteNote(note.id);
    navigate("/notes");
  };
  
  const handleGenerateCards = async () => {
    setIsGenerating(true);
    setGeneratedCards([]);
    setIsSaved(false);
    const toastId = addToast({ type: 'loading', message: 'AI sedang menyusun kartu flash...' });
    
    try {
      const res = await fetchWithAuth("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prepareContentExcerpt(title + "\n\n" + content, 4800) }),
      });
      const data = await res.json();
      if (res.ok && data.flashcards) {
        setGeneratedCards(data.flashcards);
        updateToast(toastId, { type: 'success', message: `Berhasil membuat ${data.flashcards.length} kartu flash!` });
      } else {
        updateToast(toastId, { type: 'error', message: data.error || "Gagal membuat kartu flash. Periksa API key." });
      }
    } catch (err: any) {
      console.error(err);
      updateToast(toastId, { type: 'error', message: "Gagal menghubungkan ke layanan AI." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCardsToDeck = () => {
    if (generatedCards.length === 0) return;
    
    let targetDeckId = selectedDeckId;
    if (!targetDeckId) {
      if (decks.length > 0) {
        targetDeckId = decks[0].id;
      } else {
        addToast({ type: 'error', message: "Pilih atau buat dek kartu flash terlebih dahulu." });
        return;
      }
    }
    
    generatedCards.forEach(card => {
      addFlashcard({
        front: card.front,
        back: card.back,
        deckId: targetDeckId,
        noteId: note.id
      });
    });
    
    addToast({ type: 'success', message: `${generatedCards.length} kartu flash berhasil disimpan ke dek!` });
    setIsSaved(true);
  };

  const handleAnalyzeContent = async () => {
    setIsAnalyzing(true);
    setAiSuggestions(null);
    const toastId = addToast({ type: 'loading', message: 'AI sedang menganalisis catatan...' });

    try {
      const res = await fetchWithAuth("/api/ai/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepareSuggestTagsPayload(title + "\n\n" + content, notes.filter(n => n.id !== id))),
      });
      const data = await res.json();
      if (res.ok && (data.tags || data.icon)) {
        setAiSuggestions({
          tags: data.tags || [],
          icon: data.icon || "FileText"
        });
        updateToast(toastId, { type: 'success', message: 'Analisis AI selesai!' });
      } else {
        updateToast(toastId, { type: 'error', message: data.error || "Gagal menganalisis konten." });
      }
    } catch (err: any) {
      console.error("Analysis failed:", err);
      updateToast(toastId, { type: 'error', message: "Terjadi kesalahan koneksi saat menganalisis." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const approveSuggestions = () => {
    if (!aiSuggestions) return;
    
    const currentTags = [...noteTags];
    aiSuggestions.tags.forEach(tagName => {
      const tagId = addTag(tagName);
      if (!currentTags.includes(tagId)) {
        currentTags.push(tagId);
      }
    });
    
    setNoteTags(currentTags);
    updateNote(note.id, { 
      tags: currentTags,
      icon: aiSuggestions.icon 
    });
    setAiSuggestions(null);
  };

  const discardSuggestions = () => {
    setAiSuggestions(null);
  };

  const processBidirectionalLinks = (text: string) => {
    const linkRegex = /\[\[(.*?)\]\]/g;
    return text.replace(linkRegex, (match, nodeName) => {
      const linkedNote = notes.find(n => n.title.toLowerCase() === nodeName.toLowerCase());
      if (linkedNote) {
        return `[${nodeName}](/notes/${linkedNote.id})`;
      }
      return `[${nodeName}](/graph?search=${encodeURIComponent(nodeName)})`;
    });
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tagsToCreate = tagInput.split(',').map(t => t.trim()).filter(t => t);
      
      const currentTags = [...noteTags];
      tagsToCreate.forEach(t => {
        const id = addTag(t);
        if (!currentTags.includes(id)) {
          currentTags.push(id);
        }
      });
      
      setNoteTags(currentTags);
      updateNote(note.id, { tags: currentTags });
      setTagInput("");
      setIsTagging(false);
    } else if (e.key === 'Escape') {
      setTagInput("");
      setIsTagging(false);
    }
  };

  const removeTag = (tagId: string) => {
    const currentTags = noteTags.filter(id => id !== tagId);
    setNoteTags(currentTags);
    updateNote(note.id, { tags: currentTags });
  };

  const resolvedTags = noteTags.map(id => allTags.find(t => t.id === id)).filter(Boolean);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900" onClick={() => navigate("/notes")}>
          <ArrowLeft className="w-4 h-4" /> 
          <span>Kembali</span>
        </Button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          <Button 
            variant="outline" 
            className="gap-2 text-gray-900 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300" 
            onClick={handleAnalyzeContent}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">{isAnalyzing ? "Menganalisis..." : "Analisis Catatan"}</span>
          </Button>
          <Button variant="outline" className="gap-2 text-gray-900 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300" onClick={() => setIsGeneratorOpen(true)}>
            <BrainCircuit className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Flashcard AI</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? <PenTool className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{previewMode ? "Sunting" : "Pratinjau"}</span>
          </Button>
          <Button variant="ghost" className="gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100" onClick={() => setIsDeleteDialogOpen(true)} title="Hapus Catatan">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button onClick={handleSave} className="gap-2 bg-gray-900 hover:bg-gray-800 text-white">
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Tersimpan" : "Simpan"}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-6 flex-1 flex flex-col">
        {aiSuggestions && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2 animate-in slide-in-from-top duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-900" />
                <h3 className="text-sm font-semibold text-gray-900 font-display">Saran AI (Draf)</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={discardSuggestions} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">Tolak</Button>
                <Button size="sm" onClick={approveSuggestions} className="bg-gray-900 hover:bg-gray-800 text-white gap-1">
                  <Check className="w-3.5 h-3.5" /> Terima Saran
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-xs text-gray-700 font-mono">
                <span className="text-gray-400">Ikon:</span>
                {(() => {
                  const Icon = (LucideIcons as any)[aiSuggestions.icon] || LucideIcons.FileText;
                  return <Icon className="w-4 h-4 text-gray-900" />;
                })()}
                <span className="font-medium text-gray-900">{aiSuggestions.icon}</span>
              </div>
              {aiSuggestions.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center text-xs font-mono text-gray-700">
                  <span className="text-gray-400">Tag:</span>
                  {aiSuggestions.tags.map((t, i) => (
                    <span key={i} className="text-gray-900 font-medium">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-500 font-mono mt-3 pt-2 border-t border-gray-200">
              Hasil AI — periksa ke sumber sebelum dijadikan pegangan.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {note.icon && (
              <div className="p-2.5 sm:p-3 bg-gray-50 rounded-2xl border border-gray-100 shrink-0">
                {(() => {
                   const Icon = (LucideIcons as any)[note.icon] || LucideIcons.FileText;
                   return <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-900" />;
                })()}
              </div>
            )}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 font-display bg-transparent border-none outline-none w-full placeholder:text-gray-300 focus:ring-0 p-0"
              placeholder="Judul Catatan"
              disabled={previewMode}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {resolvedTags.map(tag => (
              <span key={tag!.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">
                #{tag!.name}
                {!previewMode && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag!.id)}
                    aria-label={`Hapus tag ${tag!.name}`}
                    className="text-gray-400 hover:text-gray-900 p-1 -mr-1 rounded-lg transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            
            {!previewMode && (
              isTagging ? (
                <input
                  autoFocus
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  onBlur={() => {
                    setTagInput("");
                    setIsTagging(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 w-36 min-h-[36px]"
                  placeholder="Ketik & Enter..."
                />
              ) : (
                <button 
                  type="button"
                  onClick={() => setIsTagging(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-dashed border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors min-h-[36px]"
                >
                  <TagIcon className="w-3.5 h-3.5" /> Tambah Tag
                </button>
              )
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-gray-500 border-y border-gray-100 py-3">
          {sourceBook && (
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-800 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors min-h-[44px] md:min-h-[36px]"
              onClick={() => navigate(`/library/${sourceBook.id}`)}
            >
              <span className="font-mono text-xs text-gray-500">Sumber:</span>
              <span className="font-medium text-sm truncate max-w-[200px]">{sourceBook.title}</span>
            </button>
          )}
          <div className="relative group">
            <Folder className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select 
              value={folderId || ""}
              onChange={(e) => {
                 const newFolderId = e.target.value || null;
                 setFolderId(newFolderId);
                 updateNote(note.id, { folderId: newFolderId });
              }}
              disabled={previewMode}
              className="appearance-none bg-white border border-gray-200 text-gray-700 h-11 md:h-9 pl-9 pr-8 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="">Tanpa Folder</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative group">
            <select 
              value={type}
              onChange={(e) => {
                 setType(e.target.value as NoteType);
                 updateNote(note.id, { type: e.target.value as NoteType });
              }}
              disabled={previewMode}
              className="appearance-none bg-white border border-gray-200 text-gray-700 h-11 md:h-9 pl-3 pr-8 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="fleeting">Mentah (Kotak Masuk)</option>
              <option value="literature">Literatur (Pustaka &amp; Telaah)</option>
              <option value="permanent">Permanen (Gagasan Atomik)</option>
              <option value="knowledge">Pengetahuan (Arsip)</option>
              <option value="research">Riset (Arsip)</option>
              <option value="writing">Tulisan (Arsip)</option>
              <option value="project">Proyek (Arsip)</option>
              <option value="personal">Pribadi (Arsip)</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative group">
            <select 
              value={status}
              onChange={(e) => {
                 setStatus(e.target.value as NoteStatus);
                 updateNote(note.id, { status: e.target.value as NoteStatus });
              }}
              disabled={previewMode}
              className="appearance-none bg-white border border-gray-200 text-gray-700 h-11 md:h-9 pl-3 pr-8 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="unprocessed">Belum Diproses</option>
              <option value="processed">Terproses</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative group">
            <select 
              value={epistemicDomain}
              onChange={(e) => {
                 const val = e.target.value as any;
                 setEpistemicDomain(val);
                 updateNote(note.id, { epistemicDomain: val || undefined });
              }}
              disabled={previewMode}
              className={`appearance-none border h-11 md:h-9 pl-3 pr-8 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${epistemicDomain && epistemicDomain !== 'umum' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              <option value="">Domain: Umum</option>
              <option value="akidah">Domain: Akidah</option>
              <option value="fiqih">Domain: Fiqih</option>
              <option value="tasawuf">Domain: Tasawuf</option>
              <option value="sejarah">Domain: Sejarah</option>
            </select>
            <ChevronDown className={`w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${epistemicDomain && epistemicDomain !== 'umum' ? 'text-gray-300' : 'text-gray-400'}`} />
          </div>

          <MetadataRow
            className="w-full sm:w-auto sm:ml-auto pt-1 sm:pt-0"
            items={[
              `Dibuat ${new Date(note.createdAt).toLocaleDateString('id-ID')}`,
              `Diperbarui ${new Date(note.updatedAt).toLocaleDateString('id-ID')}`,
            ]}
          />
        </div>

        {previewMode ? (
          <div className="space-y-6 flex-1 py-4">
            {(rawQuote || referenceCitation || linkedFragments.length > 0 || linkedConcepts.length > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-6">
                {rawQuote && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 font-mono mb-2">Kutipan Mentah (Arsip)</h3>
                    <blockquote className="border-l-2 border-gray-300 pl-4 italic text-gray-700 font-serif">
                      <MarkdownRenderer>{rawQuote}</MarkdownRenderer>
                    </blockquote>
                  </div>
                )}
                {referenceCitation && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 font-mono mb-2">Sumber Referensi Asli (Arsip)</h3>
                    <p className="text-sm text-gray-700">{referenceCitation}</p>
                  </div>
                )}
                {linkedFragments.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 font-mono mb-2">Fragmen Sumber</h3>
                    <div className="space-y-3">
                      {linkedFragments.map((lf: { relation: import("../../types").Relation, fragment: import("../../types").SourceFragment }) => (
                        <blockquote key={lf.fragment.id} className="border-l-2 border-gray-400 pl-4 italic text-gray-700 font-serif">
                          <MarkdownRenderer>{lf.fragment.quote}</MarkdownRenderer>
                          <div className="flex flex-wrap items-center gap-2 mt-2 not-italic font-sans">
                            <span className="text-xs text-gray-500">— {lf.fragment.location}</span>
                            <ReliabilityBadge score={lf.fragment.reliabilityScore} />
                            <ProvenanceBadge relation={lf.relation} />
                          </div>
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}
                {linkedConcepts.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 font-mono mb-2">Tautan Konsep</h3>
                    <div className="flex flex-wrap gap-2">
                      {linkedConcepts.map((lc: { relation: import("../../types").Relation, concept: import("../../types").Concept }) => (
                        <div key={lc.relation.id} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm flex flex-wrap items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-gray-900 shrink-0" />
                          <span className="font-medium text-gray-900">{lc.concept.name}</span>
                          <span className="text-xs text-gray-500 font-mono">· {getRelationLabel(lc.relation.relationType)}</span>
                          <ProvenanceBadge relation={lc.relation} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <MarkdownRenderer className="font-serif">{processBidirectionalLinks(content)}</MarkdownRenderer>
          </div>
        ) : (
          <div className="flex flex-col space-y-6 flex-1 py-4">
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-gray-700">Kutipan Mentah <span className="text-gray-400 font-normal">(Wajib jika salah satu diisi)</span></label>
                   <textarea
                     ref={rawQuoteRef}
                     value={rawQuote}
                     onChange={(e) => {
                       setRawQuote(e.target.value);
                       if (quoteValidationError) setQuoteValidationError(null);
                     }}
                     className={`w-full min-h-[100px] py-2 px-3 text-sm leading-relaxed text-gray-700 bg-gray-50/50 border rounded-xl outline-none resize-y placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 focus:bg-white ${quoteValidationError && !rawQuote.trim() ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200'}`}
                     placeholder="Salin kutipan persis dari literatur di sini..."
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-gray-700">Sumber Referensi Asli <span className="text-gray-400 font-normal">(Wajib jika salah satu diisi)</span></label>
                   <textarea
                     ref={citationRef}
                     value={referenceCitation}
                     onChange={(e) => {
                       setReferenceCitation(e.target.value);
                       if (quoteValidationError) setQuoteValidationError(null);
                     }}
                     className={`w-full min-h-[100px] py-2 px-3 text-sm leading-relaxed text-gray-700 bg-gray-50/50 border rounded-xl outline-none resize-y placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 focus:bg-white ${quoteValidationError && !referenceCitation.trim() ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200'}`}
                     placeholder="Contoh: Hal. 45, Buku X, Penulis Y..."
                   />
                 </div>
              </div>
              {quoteValidationError && (
                <p className="text-xs font-medium text-gray-900 bg-gray-100 border border-gray-300 rounded-xl px-3 py-2">
                  {quoteValidationError}
                </p>
              )}
            </div>
            
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">Tautan &amp; Kutipan Terstruktur</label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsLinkFragmentOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Fragmen Sumber
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsLinkConceptOpen(true)}>
                    <BrainCircuit className="w-4 h-4 mr-1" />
                    Konsep
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                {linkedFragments.map((lf: { relation: import("../../types").Relation, fragment: import("../../types").SourceFragment }) => (
                  <div key={lf.fragment.id} className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm italic text-gray-700 font-serif line-clamp-2">"{lf.fragment.quote}"</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-500">{lf.fragment.location}</span>
                        <ReliabilityBadge score={lf.fragment.reliabilityScore} />
                        <ProvenanceBadge relation={lf.relation} />
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteRelation(lf.relation.id)} aria-label="Hapus tautan fragmen" className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 px-2">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex flex-wrap gap-2">
                  {linkedConcepts.map((lc: { relation: import("../../types").Relation, concept: import("../../types").Concept }) => (
                    <div key={lc.relation.id} className="bg-white border border-gray-200 rounded-xl pl-3 pr-1.5 py-1.5 text-sm flex flex-wrap items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-gray-900 shrink-0" />
                      <span className="font-medium text-gray-900">{lc.concept.name}</span>
                      <span className="text-xs text-gray-500 font-mono">· {getRelationLabel(lc.relation.relationType)}</span>
                      <ProvenanceBadge relation={lc.relation} />
                      <button
                        type="button"
                        onClick={() => deleteRelation(lc.relation.id)}
                        aria-label={`Lepas tautan ${lc.concept.name}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 flex-1 flex flex-col pt-4 border-t border-gray-100">
              <label className="text-sm font-medium text-gray-700">Inferensi / Opini Sendiri</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full flex-1 min-h-[300px] py-2 text-base sm:text-lg leading-relaxed text-gray-700 bg-transparent border-none outline-none resize-none placeholder:text-gray-300 focus:ring-0 p-0 font-serif"
                placeholder="Tuliskan pemikiran, kesimpulan, atau opini Anda sendiri di sini..."
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Hapus Catatan"
        description={`Apakah Anda yakin ingin menghapus "${note.title}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Catatan"
        onConfirm={handleDelete}
      />
      
      <Dialog open={isLinkConceptOpen} onOpenChange={setIsLinkConceptOpen}>
        <DialogHeader>
          <DialogTitle>Tautkan Konsep</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Pilih Konsep</label>
            <select
              value={selectedConcept}
              onChange={(e) => setSelectedConcept(e.target.value)}
              className="w-full h-11 md:h-9 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 bg-white"
            >
              <option value="">-- Pilih Konsep --</option>
              {concepts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipe Relasi</label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full h-11 md:h-9 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 bg-white"
            >
              <option value="expands_on">Mengembangkan</option>
              <option value="supports">Mendukung</option>
              <option value="contradicts">Bertentangan</option>
            </select>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsLinkConceptOpen(false)}>Batal</Button>
          <Button onClick={handleLinkConcept} disabled={!selectedConcept}>Tautkan</Button>
        </DialogFooter>
      </Dialog>
      
      <Dialog open={isLinkFragmentOpen} onOpenChange={setIsLinkFragmentOpen}>
        <DialogHeader>
          <DialogTitle>Tautkan Fragmen Sumber</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-gray-100 mt-2">
          <button
            type="button"
            onClick={() => setFragmentTab('create')}
            className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors min-h-[44px] sm:min-h-0 ${
              fragmentTab === 'create'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Buat Fragmen Baru
          </button>
          <button
            type="button"
            onClick={() => setFragmentTab('existing')}
            className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors min-h-[44px] sm:min-h-0 ${
              fragmentTab === 'existing'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pilih Yang Sudah Ada ({sourceFragments.length})
          </button>
        </div>

        <DialogContent>
          {fragmentTab === 'create' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kutipan / Matan Teks Asli
                </label>
                <textarea
                  value={newFragmentQuote}
                  onChange={(e) => setNewFragmentQuote(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 text-sm font-serif placeholder:font-sans"
                  placeholder="Tuliskan atau tempelkan kutipan teks asli di sini..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lokasi Rujukan / Sitasi
                </label>
                <input
                  type="text"
                  value={newFragmentLocation}
                  onChange={(e) => setNewFragmentLocation(e.target.value)}
                  className="w-full h-11 md:h-9 px-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 text-sm"
                  placeholder="Contoh: Bab 2, Hal. 45 atau Jilid 1, Hal. 102"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tingkat Keandalan Sumber
                </label>
                <select
                  value={newFragmentReliability}
                  onChange={(e) => setNewFragmentReliability(parseFloat(e.target.value))}
                  className="w-full h-11 md:h-9 px-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 text-sm bg-white"
                >
                  {RELIABILITY_LEVELS.map((level) => (
                    <option key={level.score} value={level.score}>
                      {level.label} ({level.score.toFixed(1)}) — {level.description}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1 font-mono">
                  Penetapan sadar atas derajat kekuatan dalil / referensi.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Fragmen Sumber</label>
                {sourceFragments.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-xl">
                    Belum ada fragmen sumber terdaftar. Beralih ke tab &quot;Buat Fragmen Baru&quot; untuk membuat kutipan pertama.
                  </p>
                ) : (
                  <select
                    value={selectedFragment}
                    onChange={(e) => setSelectedFragment(e.target.value)}
                    className="w-full h-11 md:h-9 px-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 text-sm bg-white"
                  >
                    <option value="">-- Pilih Fragmen --</option>
                    {sourceFragments.map(f => (
                      <option key={f.id} value={f.id}>
                        [{f.location || 'Tanpa rujukan'}] {f.quote.substring(0, 60)}...
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </DialogContent>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsLinkFragmentOpen(false)}>Batal</Button>
          {fragmentTab === 'create' ? (
            <Button onClick={handleCreateAndLinkFragment} disabled={!newFragmentQuote.trim()}>
              Simpan &amp; Tautkan
            </Button>
          ) : (
            <Button onClick={handleLinkFragment} disabled={!selectedFragment}>
              Tautkan
            </Button>
          )}
        </DialogFooter>
      </Dialog>
      
      <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen} maxWidthClass="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-gray-900" /> 
            Generator Flashcard AI
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-4 py-2">
          {generatedCards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4 text-sm">AI akan menganalisis catatan ini dan membuat 5-10 kartu tanya jawab untuk Anda pelajari.</p>
              <Button onClick={handleGenerateCards} disabled={isGenerating} className="bg-gray-900 hover:bg-gray-800 text-white">
                {isGenerating ? "Sedang Mengekstrak..." : "Mulai Buat Kartu"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 text-gray-900 p-3 rounded-xl text-sm flex items-center justify-between">
                <span>Berhasil membuat {generatedCards.length} kartu.</span>
                <Button variant="ghost" size="sm" onClick={() => setGeneratedCards([])} className="px-2.5 text-gray-800 hover:bg-gray-100">Buat Ulang</Button>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                {generatedCards.map((card, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm text-sm space-y-2">
                    <p><span className="font-semibold text-gray-700">T:</span> {card.front}</p>
                    <p className="text-gray-600"><span className="font-semibold text-gray-700">J:</span> {card.back}</p>
                  </div>
                ))}
              </div>
              
              <p className="text-[11px] text-gray-500 font-mono">
                Hasil AI — periksa ke sumber sebelum dijadikan pegangan.
              </p>
              
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="text-sm font-medium text-gray-700">Simpan ke Dek</label>
                <div className="relative">
                  <select 
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-200 text-gray-700 h-11 md:h-9 pl-3 pr-8 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                  >
                    <option value="" disabled>Pilih Dek...</option>
                    {decks.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsGeneratorOpen(false)}>Batal</Button>
          {generatedCards.length > 0 && (
            <Button onClick={handleSaveCardsToDeck} disabled={!selectedDeckId || isSaved} className="bg-gray-900 hover:bg-gray-800 text-white gap-2">
              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isSaved ? "Tersimpan" : "Simpan ke Dek"}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}
