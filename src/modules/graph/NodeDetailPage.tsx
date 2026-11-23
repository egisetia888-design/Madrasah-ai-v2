import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, ArrowRight, Book, FileText, PenTool, Hash, Network, FolderKanban } from "lucide-react";
import { useKnowledgeGraph } from "../../hooks/useKnowledgeGraph";
import { useNotesStore } from "../../store/notesStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useWritingStore } from "../../store/writingStore";
import { useProjectsStore } from "../../store/projectsStore";
import { useKnowledgeStore } from "../../store/knowledgeStore";
import { MetadataRow } from "../../components/ui/MetadataRow";

const NODE_TYPE_LABELS: Record<string, string> = {
  note: "Catatan",
  book: "Pustaka",
  writing: "Tulisan",
  project: "Proyek",
  concept: "Konsep",
  author: "Penulis",
  source_fragment: "Fragmen Sumber",
};

export function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { nodes, edges } = useKnowledgeGraph();
  const notes = useNotesStore(state => state.notes);
  const books = useLibraryStore(state => state.books);
  const authors = useLibraryStore(state => state.authors);
  const drafts = useWritingStore(state => state.drafts);
  const projects = useProjectsStore(state => state.projects);
  const concepts = useKnowledgeStore(state => state.concepts);
  const fragments = useKnowledgeStore(state => state.sourceFragments);

  const node = nodes.find(n => n.id === id);

  const incomingEdges = useMemo(() => edges.filter(e => e.target === id), [edges, id]);
  const outgoingEdges = useMemo(() => edges.filter(e => e.source === id), [edges, id]);

  const relatedNodes = useMemo(() => {
    const ids = Array.from(
      new Set([...incomingEdges.map(e => e.source), ...outgoingEdges.map(e => e.target)])
    );
    return ids
      .map(rId => nodes.find(n => n.id === rId))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [incomingEdges, outgoingEdges, nodes]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-900 font-display">Simpul tidak ditemukan</h2>
        <Button variant="outline" onClick={() => navigate("/graph")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Graf
        </Button>
      </div>
    );
  }

  const getNodeDescription = () => {
    switch (node.type) {
      case "note": {
        const note = notes.find(n => n.id === node.id);
        return note?.content?.trim() || "Catatan ini belum memiliki isi uraian.";
      }
      case "book": {
        const book = books.find(b => b.id === node.id);
        const author = book?.authorId ? authors.find(a => a.id === book.authorId) : null;
        if (!book) return "Materi pustaka dalam koleksi Anda.";
        return `Oleh ${author?.name || "Penulis tidak diketahui"} · Progres ${book.progress} dari ${book.totalPages || "?"} halaman.`;
      }
      case "writing": {
        const draft = drafts.find(d => d.id === node.id);
        return draft?.content?.trim() || "Draf tulisan ini belum memiliki isi.";
      }
      case "project": {
        const project = projects.find(p => p.id === node.id);
        return project?.description?.trim() || "Proyek aktif dalam ruang kerja Anda.";
      }
      case "concept": {
        const concept = concepts.find(c => c.id === node.id);
        return (
          concept?.definition?.trim() ||
          `Konsep "${node.label}" menghimpun catatan, pustaka, dan tulisan yang saling merujuk.`
        );
      }
      case "source_fragment": {
        const fragment = fragments.find(f => f.id === node.id);
        return fragment
          ? `"${fragment.quote}"${fragment.location ? ` (${fragment.location})` : ""}`
          : "Fragmen kutipan sumber literatur.";
      }
      case "author": {
        const author = authors.find(a => a.id === node.id);
        const authorBookCount = books.filter(b => b.authorId === node.id).length;
        return author
          ? `${author.name} · ${authorBookCount} karya dalam pustaka pribadi Anda.`
          : "Penulis materi bacaan di pustaka pribadi Anda.";
      }
      default:
        return `Entitas ${node.label} dalam jaringan pengetahuan Anda.`;
    }
  };

  const canOpenEditor = ["book", "note", "writing", "project"].includes(node.type);

  const handleOpenEditor = () => {
    if (node.type === "book") navigate(`/library/${node.id}`);
    else if (node.type === "note") navigate(`/notes/${node.id}`);
    else if (node.type === "writing") navigate(`/writing/${node.id}`);
    else if (node.type === "project") navigate(`/projects/${node.id}`);
  };

  const linkedNotes = relatedNodes.filter(n => n.type === "note");
  const linkedBooks = relatedNodes.filter(n => n.type === "book");
  const linkedOutputs = relatedNodes.filter(n => n.type === "writing" || n.type === "project");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-gray-100 pb-6">
        <Button
          variant="ghost"
          className="gap-2 -ml-3 text-gray-500 hover:text-gray-900 self-start shrink-0"
          onClick={() => navigate("/graph")}
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Graf
        </Button>
        <div className="flex-1 min-w-0 space-y-1.5">
          <MetadataRow
            items={[
              NODE_TYPE_LABELS[node.type] || node.type,
              `${relatedNodes.length} simpul terhubung`,
            ]}
          />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display break-words">
            {node.label}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Col: Main Info */}
        <div className="md:col-span-2 space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 font-display border-b border-gray-100 pb-2">
              Deskripsi
            </h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-line line-clamp-6">
              {getNodeDescription()}
            </p>
            {canOpenEditor && (
              <div className="pt-2">
                <Button variant="outline" onClick={handleOpenEditor}>
                  Buka Editor Lengkap
                </Button>
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Tautan Masuk
              </h3>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-display tabular-nums">
                {incomingEdges.length}
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
                Tautan Keluar <ArrowRight className="w-3.5 h-3.5" />
              </h3>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-display tabular-nums">
                {outgoingEdges.length}
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 font-display border-b border-gray-100 pb-2 flex items-center gap-2">
              <Network className="w-5 h-5 text-gray-400" /> Daftar Relasi ({incomingEdges.length + outgoingEdges.length})
            </h2>
            {incomingEdges.length === 0 && outgoingEdges.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Belum ada relasi langsung pada simpul ini.</p>
            ) : (
              <div className="space-y-2">
                {outgoingEdges.map(edge => {
                  const targetNode = nodes.find(n => n.id === edge.target);
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => targetNode && navigate(`/graph/${targetNode.id}`)}
                      className="w-full text-left p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-gray-900 font-medium truncate">
                        → {targetNode?.label || edge.target}
                      </span>
                      <span className="text-xs text-gray-500 font-mono shrink-0">{edge.label}</span>
                    </button>
                  );
                })}
                {incomingEdges.map(edge => {
                  const sourceNode = nodes.find(n => n.id === edge.source);
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => sourceNode && navigate(`/graph/${sourceNode.id}`)}
                      className="w-full text-left p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-gray-900 font-medium truncate">
                        ← {sourceNode?.label || edge.source}
                      </span>
                      <span className="text-xs text-gray-500 font-mono shrink-0">{edge.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Col: Connections */}
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-gray-900 font-mono uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-400" /> Simpul Terkait ({relatedNodes.length})
            </h2>
            <div className="flex flex-col gap-1.5">
              {relatedNodes.length > 0 ? (
                relatedNodes.map(rNode => (
                  <button
                    key={rNode.id}
                    type="button"
                    onClick={() => navigate(`/graph/${rNode.id}`)}
                    className="text-left text-sm text-gray-800 hover:text-gray-900 hover:underline py-1 truncate"
                  >
                    {rNode.label}
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic">Belum ada simpul terhubung.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-bold text-gray-900 font-mono uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" /> Catatan Terkait ({linkedNotes.length})
            </h2>
            {linkedNotes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {linkedNotes.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/notes/${item.id}`)}
                    className="text-left text-sm text-gray-800 hover:text-gray-900 hover:underline py-1 truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Belum ada catatan yang terhubung.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-bold text-gray-900 font-mono uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <Book className="w-4 h-4 text-gray-400" /> Pustaka Terkait ({linkedBooks.length})
            </h2>
            {linkedBooks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {linkedBooks.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/library/${item.id}`)}
                    className="text-left text-sm text-gray-800 hover:text-gray-900 hover:underline py-1 truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Belum ada pustaka yang terhubung.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-bold text-gray-900 font-mono uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              {linkedOutputs.some(o => o.type === "project") ? (
                <FolderKanban className="w-4 h-4 text-gray-400" />
              ) : (
                <PenTool className="w-4 h-4 text-gray-400" />
              )}
              Tulisan &amp; Proyek ({linkedOutputs.length})
            </h2>
            {linkedOutputs.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {linkedOutputs.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigate(item.type === "writing" ? `/writing/${item.id}` : `/projects/${item.id}`)
                    }
                    className="text-left text-sm text-gray-800 hover:text-gray-900 hover:underline py-1 truncate"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Belum ada tulisan atau proyek tertaut.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

