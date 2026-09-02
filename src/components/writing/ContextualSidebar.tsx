import React, { useEffect, useState, useMemo } from 'react';
import { Sparkles, FileText, ChevronRight, Book, Brain, ArrowUpRight, Link2, Loader2 } from 'lucide-react';
import { useNotesStore } from '../../store/notesStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useLibraryStore } from '../../store/libraryStore';
import { searchSemantic, useSemanticSearchStore } from '../../lib/semanticSearch';
import { scanTextForEntities, createExplicitRelation, DetectedEntity } from '../../utils/autoLinker';
import { useNavigate } from 'react-router-dom';

interface ContextualSidebarProps {
  title: string;
  content: string;
  currentDraftId: string;
  onInsertWikilink?: (title: string) => void;
}

export function ContextualSidebar({ title, content, currentDraftId, onInsertWikilink }: ContextualSidebarProps) {
  const navigate = useNavigate();
  const notes = useNotesStore(state => state.notes);
  const concepts = useKnowledgeStore(state => state.concepts);
  const books = useLibraryStore(state => state.books);

  const [semanticSuggestions, setSemanticSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isModelLoading = useSemanticSearchStore(state => state.isModelLoading);

  // Live entity detection from draft text
  const detectedEntities = useMemo(() => {
    const fullText = `${title}\n${content}`;
    return scanTextForEntities(fullText, currentDraftId);
  }, [title, content, currentDraftId, concepts, books, notes]);

  useEffect(() => {
    const findRelatedNotes = async () => {
      const fullText = `${title} ${content}`.trim();
      if (fullText.length < 40) {
        setSemanticSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const noteItems = notes.map(n => ({ id: n.id, embedding: n.embedding }));
        const results = await searchSemantic(fullText, noteItems);

        const topResults = results.slice(0, 4).map(res => {
          const note = notes.find(n => n.id === res.id);
          return {
            ...note,
            similarity: res.similarity
          };
        }).filter(item => item && item.id);

        setSemanticSuggestions(topResults);
      } catch (err) {
        console.error('Contextual search failed:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(findRelatedNotes, 1200);
    return () => clearTimeout(timer);
  }, [title, content, notes]);

  const handleQuickLink = (entity: DetectedEntity) => {
    createExplicitRelation(
      currentDraftId,
      entity.id,
      entity.relationType,
      `Terdeteksi di draf "${title}"`
    );
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'concept': return <Brain className="w-3 h-3 text-gray-700" />;
      case 'book': return <Book className="w-3 h-3 text-gray-700" />;
      default: return <FileText className="w-3 h-3 text-gray-700" />;
    }
  };

  return (
    <aside className="w-80 shrink-0 hidden xl:flex flex-col border-l border-gray-200 bg-white/70 backdrop-blur-sm sticky top-0 h-[calc(100vh-64px)] overflow-y-auto p-5 animate-in fade-in duration-300">

      {/* Detected Entities Section */}
      {detectedEntities.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
              <Link2 className="w-3.5 h-3.5 text-gray-500" />
              <span>Entitas Terdeteksi ({detectedEntities.length})</span>
            </div>
          </div>

          <div className="space-y-2">
            {detectedEntities.map((entity) => (
              <div
                key={entity.id}
                className="p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {getEntityIcon(entity.type)}
                  <span className="font-semibold text-gray-900 truncate">{entity.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onInsertWikilink && (
                    <button
                      onClick={() => onInsertWikilink(entity.label)}
                      title="Sisipkan [[WikiLink]]"
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
                    >
                      [[+]]
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickLink(entity)}
                    title="Tautkan ke Graf Pengetahuan"
                    className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-200/60"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semantic References Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5 text-gray-700" />
            <span>Referensi Relevan</span>
          </div>
          {isModelLoading && (
            <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
          )}
        </div>

        {isModelLoading && (
          <div className="p-3 text-center text-[10px] text-gray-500 border border-gray-100 bg-gray-50 rounded-xl font-mono">
            Menyiapkan pencarian semantik...
          </div>
        )}

        {isSearching && !isModelLoading && semanticSuggestions.length === 0 && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
            ))}
          </div>
        )}

        {semanticSuggestions.length === 0 && !isSearching && !isModelLoading && detectedEntities.length === 0 && (
          <div className="p-5 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
            Tuliskan lebih banyak konten untuk melihat saran relasi dan catatan terkait secara otomatis.
          </div>
        )}

        {semanticSuggestions.map((note) => (
          <div
            key={note.id}
            onClick={() => navigate(`/notes/${note.id}`)}
            className="group p-3.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-xs transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-700 uppercase tracking-widest font-mono">
                <FileText className="w-3 h-3 text-gray-500" />
                Catatan
              </div>
              <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                {Math.round(note.similarity * 100)}% Match
              </span>
            </div>
            <h4 className="text-xs font-semibold text-gray-900 line-clamp-1 group-hover:text-gray-700 transition-colors mb-1">
              {note.title}
            </h4>
            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed font-serif">
              {note.content}
            </p>
            <div className="flex items-center text-[10px] font-semibold text-gray-900 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Buka Catatan <ChevronRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center leading-relaxed font-mono">
          Auto-Linking & Semantic Engine aktif secara lokal
        </p>
      </div>
    </aside>
  );
}
