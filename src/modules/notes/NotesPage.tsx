import { useState, useMemo } from "react"
import { Button } from "../../components/ui/Button"
import { Plus, Sparkles, Filter, Zap } from "lucide-react"
import { useNotesStore } from "../../store/notesStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { autoLinkSingleEntity, scanTextForEntities, runAutoLinker } from "../../utils/autoLinker"
import { NoteType } from "../../types"
import { cn } from "../../utils/cn"
import { useToastStore } from "../../store/toastStore"
import { NotesSidebar } from "./components/NotesSidebar"
import { NotesGrid } from "./components/NotesGrid"
import { AddNoteDialog } from "./components/AddNoteDialog"
import { AddFolderDialog } from "./components/AddFolderDialog"
import { AIAssistantDialog } from "./components/AIAssistantDialog"

export function NotesPage() {
  const notes = useNotesStore(state => state.notes)
  const folders = useNotesStore(state => state.folders)
  const allTags = useNotesStore(state => state.tags)
  const addNote = useNotesStore(state => state.addNote)
  const addFolder = useNotesStore(state => state.addFolder)
  const addToast = useToastStore(state => state.addToast)
  const updateToast = useToastStore(state => state.updateToast)
  const storedRelations = useKnowledgeStore(state => state.relations)

  // Dialog & Action States
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false)
  const [isAutoLinking, setIsAutoLinking] = useState(false)

  // Note Form
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [rawQuote, setRawQuote] = useState("")
  const [referenceCitation, setReferenceCitation] = useState("")
  const [noteType, setNoteType] = useState<NoteType>('knowledge')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  // Tagging
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [, setSuggestedConnections] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const addTag = useNotesStore(state => state.addTag)

  // Live Auto-Link Entity Detection
  const liveDetectedEntities = useMemo(() => {
    return scanTextForEntities(`${title}\n${content}\n${rawQuote}`);
  }, [title, content, rawQuote]);

  // Folder Form
  const [newFolderName, setNewFolderName] = useState("")

  // Assistant
  const [prompt, setPrompt] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // View & Filter State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTab, setActiveTab] = useState<'all' | NoteType>('all')
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      if (activeTab !== 'all' && n.type !== activeTab) return false;
      if (activeFolderId && n.folderId !== activeFolderId) return false;
      if (activeTagId && !n.tags.includes(activeTagId)) return false;
      if (searchTerm) {
         const searchLower = searchTerm.toLowerCase();
         return n.title.toLowerCase().includes(searchLower) || n.content.toLowerCase().includes(searchLower);
      }
      return true;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, activeTab, activeFolderId, activeTagId, searchTerm])

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    if ((rawQuote.trim() && !referenceCitation.trim()) || (!rawQuote.trim() && referenceCitation.trim())) {
      alert("Jika Anda memasukkan Kutipan Mentah atau Sumber Referensi, keduanya wajib diisi untuk menjaga jejak epistemologis.");
      return;
    }

    // Process tags
    const finalTags = [...selectedTags];
    if (tagInput.trim()) {
      const tagsToCreate = tagInput.split(',').map(t => t.trim()).filter(t => t);
      tagsToCreate.forEach(t => {
        const id = addTag(t);
        if (!finalTags.includes(id)) finalTags.push(id);
      });
    }

    const id = addNote({
      title: title.trim(),
      content: content.trim(),
      rawQuote: rawQuote.trim(),
      referenceCitation: referenceCitation.trim(),
      type: noteType,
      status: 'unprocessed',
      folderId: selectedFolder || activeFolderId,
      tags: finalTags,
    })

    // Automatically link mentions and concepts in this note
    const linkedCount = autoLinkSingleEntity(id, `${title.trim()}\n${content.trim()}\n${rawQuote.trim()}`, 'note', title.trim());
    if (linkedCount > 0) {
      addToast({
        type: 'success',
        message: `Catatan disimpan & ${linkedCount} relasi otomatis ditautkan ke Knowledge Graph!`
      });
    }

    // Index for semantic search
    useNotesStore.getState().indexNote(id);

    setTitle("")
    setContent("")
    setRawQuote("")
    setReferenceCitation("")
    setNoteType('knowledge')
    setSelectedTags([])
    setSuggestedTags([])
    setSuggestedConnections([])
    setTagInput("")
    setIsAddOpen(false)
  }

  const handleGlobalAutoLink = () => {
    setIsAutoLinking(true);
    addToast({ type: 'loading', message: 'Memindai seluruh catatan & menautkan relasi...' });
    setTimeout(() => {
      try {
        const result = runAutoLinker();
        if (result.newAdded > 0) {
          addToast({
            type: 'success',
            message: `Berhasil menemukan ${result.totalDiscovered} koneksi dan menambahkan ${result.newAdded} relasi baru!`
          });
        } else {
          addToast({
            type: 'info',
            message: `Seluruh ${result.totalDiscovered} relasi catatan sudah tersinkronisasi otomatis.`
          });
        }
      } catch (err: any) {
        addToast({ type: 'error', message: 'Gagal menjalankan sinkronisasi relasi.' });
      } finally {
        setIsAutoLinking(false);
      }
    }, 400);
  };

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setNewFolderName("");
      setIsAddFolderOpen(false);
    }
  }

  const handleSuggest = async () => {
    if (!content.trim()) return;
    setIsSuggesting(true);
    const toastId = addToast({ type: 'loading', message: 'AI sedang menganalisis saran tag...' });
    try {
      const { concepts } = useKnowledgeStore.getState();
      const res = await fetch("/api/ai/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, notes, concepts }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.tags) setSuggestedTags(data.tags);
        if (data.connections) setSuggestedConnections(data.connections);
        updateToast(toastId, { type: 'success', message: 'Saran tag dari AI berhasil dimuat.' });
      } else {
        updateToast(toastId, { type: 'error', message: data.error || "Gagal mendapatkan saran tag dari AI." });
      }
    } catch (err: any) {
      console.error(err);
      updateToast(toastId, { type: 'error', message: "Gagal menghubungkan ke layanan AI." });
    } finally {
      setIsSuggesting(false);
    }
  }

  const toggleTag = (tagName: string) => {
    const id = addTag(tagName);
    if (selectedTags.includes(id)) {
      setSelectedTags(selectedTags.filter(t => t !== id));
    } else {
      setSelectedTags([...selectedTags, id]);
    }
  }

  const handleAskAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsLoading(true);
    setAiResponse("");
    const toastId = addToast({ type: 'loading', message: 'AI sedang memproses pertanyaan...' });
    try {
      const { concepts, sourceFragments, relations } = useKnowledgeStore.getState();

      const res = await fetch("/api/ai/zettelkasten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, notes, concepts, fragments: sourceFragments, relations }),
      });

      const data = await res.json();

      if (res.ok) {
        setAiResponse(data.result);
        updateToast(toastId, { type: 'success', message: 'Tanggapan AI selesai.' });
      } else {
        setAiResponse(`Error: ${data.error}`);
        updateToast(toastId, { type: 'error', message: data.error || "Gagal mendapatkan respon AI." });
      }
    } catch (err: any) {
      setAiResponse(`Failed to connect to the assistant: ${err.message}`);
      updateToast(toastId, { type: 'error', message: "Gagal menghubungkan ke layanan AI." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 w-full min-w-0 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Knowledge Database</h1>
          <p className="text-gray-500 mt-0.5 text-xs sm:text-sm">Zettelkasten & Catatan Pembelajaran Anda</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="gap-2 h-11 sm:h-9 text-gray-900 border-gray-300 hover:bg-gray-100 rounded-xl"
            onClick={handleGlobalAutoLink}
            disabled={isAutoLinking}
            title="Pindai seluruh catatan dan tautkan entitas secara otomatis ke Knowledge Graph"
          >
            <Zap className={cn("w-4 h-4 text-gray-900", isAutoLinking && "animate-spin")} />
            <span className="hidden sm:inline">{isAutoLinking ? "Menautkan..." : "Tautkan Otomatis"}</span>
            <span className="sm:hidden">{isAutoLinking ? "..." : "Auto-Link"}</span>
          </Button>
          <Button variant="outline" className="gap-2 h-11 sm:h-9 rounded-xl" onClick={() => setIsAssistantOpen(true)}>
            <Sparkles className="w-4 h-4 text-gray-500" />
            <span>Tanya AI</span>
          </Button>
          <Button className="gap-2 h-11 sm:h-9 col-span-2 sm:col-span-1 rounded-xl" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Catatan Baru</span>
          </Button>
        </div>
      </div>

      {/* Quick Mobile Horizontal Category Tabs */}
      <div className="lg:hidden mb-4 space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full no-scrollbar py-1 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'knowledge', label: 'Knowledge' },
            { id: 'research', label: 'Research' },
            { id: 'project', label: 'Project' },
            { id: 'writing', label: 'Writing' },
            { id: 'personal', label: 'Personal' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer",
                activeTab === tab.id
                  ? "bg-gray-900 text-white shadow-sm font-semibold"
                  : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter className="w-4 h-4 text-gray-500" />
            <span>Filter Folder & Tag</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="h-8 px-3 text-xs font-semibold rounded-xl"
          >
            {mobileFiltersOpen ? "Tutup" : "Buka Filter"}
          </Button>
        </div>

        {/* Sidebar Filters */}
        <NotesSidebar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          folders={folders}
          activeFolderId={activeFolderId}
          setActiveFolderId={setActiveFolderId}
          setIsAddFolderOpen={setIsAddFolderOpen}
          allTags={allTags}
          activeTagId={activeTagId}
          setActiveTagId={setActiveTagId}
          mobileFiltersOpen={mobileFiltersOpen}
        />

        {/* Main Content Grid/List */}
        <NotesGrid
          filteredNotes={filteredNotes}
          folders={folders}
          allTags={allTags}
          storedRelations={storedRelations}
          viewMode={viewMode}
          setViewMode={setViewMode}
          setIsAddOpen={setIsAddOpen}
        />
      </div>

      {/* Dialogs */}
      <AddFolderDialog
        isAddFolderOpen={isAddFolderOpen}
        setIsAddFolderOpen={setIsAddFolderOpen}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleAddFolder={handleAddFolder}
      />

      <AddNoteDialog
        isAddOpen={isAddOpen}
        setIsAddOpen={setIsAddOpen}
        handleAddNote={handleAddNote}
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        rawQuote={rawQuote}
        setRawQuote={setRawQuote}
        referenceCitation={referenceCitation}
        setReferenceCitation={setReferenceCitation}
        noteType={noteType}
        setNoteType={setNoteType}
        selectedFolder={selectedFolder}
        setSelectedFolder={setSelectedFolder}
        folders={folders}
        tagInput={tagInput}
        setTagInput={setTagInput}
        liveDetectedEntities={liveDetectedEntities}
        handleSuggest={handleSuggest}
        isSuggesting={isSuggesting}
        suggestedTags={suggestedTags}
        selectedTags={selectedTags}
        toggleTag={toggleTag}
        allTags={allTags}
      />

      <AIAssistantDialog
        isAssistantOpen={isAssistantOpen}
        setIsAssistantOpen={setIsAssistantOpen}
        prompt={prompt}
        setPrompt={setPrompt}
        aiResponse={aiResponse}
        isLoading={isLoading}
        handleAskAssistant={handleAskAssistant}
      />
    </div>
  )
}
