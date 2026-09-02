import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, PenLine, Briefcase, Book, Network, Brain, Plus, Command, CornerDownLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "../ui/Dialog";
import { useNotesStore } from "../../store/notesStore";
import { useWritingStore } from "../../store/writingStore";
import { useProjectsStore } from "../../store/projectsStore";
import { useReviewStore } from "../../store/reviewStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useUIStore } from "../../store/uiStore";
import { cn } from "../../utils/cn";
import { searchSemantic, SemanticSearchResult, useSemanticSearchStore } from "../../lib/semanticSearch";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const notes = useNotesStore(state => state.notes);
  const drafts = useWritingStore(state => state.drafts);
  const projects = useProjectsStore(state => state.projects);
  const decks = useReviewStore(state => state.decks);
  const books = useLibraryStore(state => state.books);

  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const isModelLoading = useSemanticSearchStore(state => state.isModelLoading);

  useEffect(() => {
    const performSemanticSearch = async () => {
      if (!query.trim() || query.length < 3) {
        setSemanticResults([]);
        return;
      }
      
      setIsSearchingSemantic(true);
      try {
        const allItems = [
          ...notes.map(n => ({ id: n.id, embedding: n.embedding })),
          ...drafts.map(d => ({ id: d.id, embedding: d.embedding }))
        ];
        
        const semantic = await searchSemantic(query, allItems);
        setSemanticResults(semantic);
      } catch (err) {
        console.error('Semantic search failed:', err);
      } finally {
        setIsSearchingSemantic(false);
      }
    };

    const timer = setTimeout(performSemanticSearch, 500);
    return () => clearTimeout(timer);
  }, [query, notes, drafts]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Actions
  const globalActions = [
    { id: 'nav-graph', title: 'Buka Knowledge Graph', type: 'Navigasi', icon: Network, action: () => handleSelect('/graph') },
    { id: 'nav-review', title: 'Mulai Sesi Review', type: 'Navigasi', icon: Brain, action: () => handleSelect('/review') },
  ];

  const searchResults = () => {
    const term = query.toLowerCase();
    const results: any[] = [];

    // If query is empty, show default actions and recent items
    if (!term.trim()) {
      return globalActions;
    }

    // Filter global actions
    globalActions.forEach(action => {
      if (action.title.toLowerCase().includes(term) || action.type.toLowerCase().includes(term)) {
        results.push(action);
      }
    });

    notes.forEach(note => {
      if (note.title.toLowerCase().includes(term) || note.content.toLowerCase().includes(term)) {
        results.push({ id: note.id, title: note.title, type: 'Catatan', icon: FileText, action: () => handleSelect(`/notes/${note.id}`) });
      }
    });

    drafts.forEach(draft => {
      if (draft.title.toLowerCase().includes(term) || draft.content.toLowerCase().includes(term)) {
        results.push({ id: draft.id, title: draft.title, type: 'Draf', icon: PenLine, action: () => handleSelect(`/writing/${draft.id}`) });
      }
    });

    books.forEach(book => {
      if (book.title.toLowerCase().includes(term)) {
        results.push({ id: book.id, title: book.title, type: "Pustaka", icon: Book, action: () => handleSelect(`/library/${book.id}`) });
      }
    });

    projects.forEach(project => {
      if (project.title.toLowerCase().includes(term) || project.description.toLowerCase().includes(term)) {
        results.push({ id: project.id, title: project.title, type: 'Proyek', icon: Briefcase, action: () => handleSelect(`/projects/${project.id}`) });
      }
    });

    return results;
  };

  // Combine results
  const combinedResults = () => {
    const base = searchResults();
    if (!query.trim()) return base;

    const semanticItems = semanticResults.map(res => {
      const note = notes.find(n => n.id === res.id);
      if (note) {
        return { 
          id: note.id, 
          title: note.title, 
          type: 'Catatan (Semantik)', 
          icon: FileText, 
          action: () => handleSelect(`/notes/${note.id}`),
          relevance: res.similarity 
        };
      }
      const draft = drafts.find(d => d.id === res.id);
      if (draft) {
        return { 
          id: draft.id, 
          title: draft.title, 
          type: 'Draf (Semantik)', 
          icon: PenLine, 
          action: () => handleSelect(`/writing/${draft.id}`),
          relevance: res.similarity
        };
      }
      return null;
    }).filter(Boolean);

    // Merge and remove duplicates (prefer keyword match if it exists)
    const finalResults = [...base];
    semanticItems.forEach((item: any) => {
      if (!finalResults.find(r => r.id === item.id)) {
        finalResults.push(item);
      }
    });

    return finalResults;
  };

  const finalItems = combinedResults();

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };
  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden bg-white shadow-2xl border-0 rounded-2xl">
        <div className="flex items-center pl-4 pr-12 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari atau ketik perintah..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-400 text-base sm:text-lg font-sans"
          />
          <kbd className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-md border border-gray-200">ESC</kbd>
        </div>
        
        {isModelLoading && (
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
            <span className="text-xs font-medium text-gray-600">Menyiapkan pencarian semantik...</span>
          </div>
        )}

        <div className="max-h-[350px] overflow-y-auto p-2 no-scrollbar bg-gray-50/50">
          {finalItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 flex flex-col items-center">
              <Command className="w-8 h-8 text-gray-300 mb-3" />
              Tidak ada hasil untuk "{query}"
              {isSearchingSemantic && !isModelLoading && <p className="mt-2 text-xs text-gray-400">Sedang mencari makna...</p>}
            </div>
          ) : (
            <div className="space-y-1">
              {!query.trim() && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi Cepat</div>}
              {finalItems.map((result, i) => {
                const Icon = result.icon;
                return (
                  <button
                    key={`${result.id}-${i}`}
                    onClick={result.action}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-white hover:shadow-sm rounded-xl transition-all focus:bg-white focus:shadow-sm focus:outline-none group border border-transparent hover:border-gray-200"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-50 group-hover:text-gray-900 transition-colors">
                      <Icon className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{result.title}</h4>
                      <p className="text-xs text-gray-500 capitalize">{result.type}</p>
                    </div>
                    <CornerDownLeft className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
