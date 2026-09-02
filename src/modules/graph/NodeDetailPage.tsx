import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Book, FileText, PenTool, Hash, Activity } from "lucide-react";
import { useKnowledgeGraph } from "../../hooks/useKnowledgeGraph";

export function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { nodes, edges } = useKnowledgeGraph();
  
  const node = nodes.find(n => n.id === id);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-medium text-gray-900">Node not found</h2>
        <Button variant="outline" onClick={() => navigate("/graph")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Graph
        </Button>
      </div>
    );
  }

  // Find linked entities
  const incomingEdges = edges.filter(e => e.target === id);
  const outgoingEdges = edges.filter(e => e.source === id);
  
  const relatedNodesIds = Array.from(new Set([...incomingEdges.map(e => e.source), ...outgoingEdges.map(e => e.target)]));
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
         <Button variant="ghost" className="gap-2 -ml-3 text-gray-500 hover:text-gray-900 shrink-0" onClick={() => navigate(-1)}>
           <ArrowLeft className="w-4 h-4" /> Back
         </Button>
         <div className="flex-1">
           <div className="flex items-center gap-2 mb-1">
             <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{node.type}</span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">{node.label}</h1>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Col: Main Info */}
        <div className="md:col-span-2 space-y-8">
          <section className="space-y-3">
             <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Description</h2>
             <p className="text-gray-600 text-sm leading-relaxed">
               {node.type === 'concept' ? `This concept represents the idea of ${node.label} within the knowledge base. It aggregates thoughts, references, and projects related to this domain.` : 
                `Details and content for ${node.label} would appear here, linking out to the specific editor or viewer for this entity type.`}
             </p>
             {node.type !== 'concept' && (
               <Button variant="outline" className="mt-4" onClick={() => {
                  if (node!.type === 'book') navigate(`/library/${node!.id}`);
                  if (node!.type === 'note') navigate(`/notes/${node!.id}`);
               }}>
                 Open Full Editor
               </Button>
             )}
          </section>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
               <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                 <ArrowLeft className="w-4 h-4" /> Backlinks
               </h3>
               <div className="text-2xl font-bold text-gray-900">{incomingEdges.length}</div>
             </div>
             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
               <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                 Forward Links <ArrowLeft className="w-4 h-4 rotate-180" />
               </h3>
               <div className="text-2xl font-bold text-gray-900">{outgoingEdges.length}</div>
             </div>
          </div>

          <section className="space-y-3">
             <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
               <Activity className="w-5 h-5 text-gray-400" /> Timeline
             </h2>
             <div className="space-y-4 pt-2">
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-gray-500 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Node referenced in new note</p>
                    <p className="text-xs text-gray-500">Today</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Node created</p>
                    <p className="text-xs text-gray-500">2 weeks ago</p>
                  </div>
                </div>
             </div>
          </section>
        </div>

        {/* Right Col: Connections */}
        <div className="space-y-6">
          <section className="space-y-3">
             <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
               <Hash className="w-4 h-4 text-gray-400" /> Related Nodes
             </h2>
             <div className="flex flex-col gap-2">
               {relatedNodesIds.length > 0 ? (
                 relatedNodesIds.map(rId => (
                   <div key={rId} onClick={() => navigate(`/graph/${rId}`)} className="text-sm text-gray-900 hover:underline cursor-pointer">
                     {rId.startsWith('tag-') ? rId.replace('tag-', '#') : 'Node: ' + rId.substring(0,8)}
                   </div>
                 ))
               ) : (
                 <p className="text-sm text-gray-500 italic">No connected nodes.</p>
               )}
             </div>
          </section>

          <section className="space-y-3">
             <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
               <FileText className="w-4 h-4 text-gray-400" /> Linked Notes
             </h2>
             <p className="text-sm text-gray-500 italic">Will automatically list notes that mention this entity.</p>
          </section>
          
          <section className="space-y-3">
             <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
               <Book className="w-4 h-4 text-gray-400" /> Linked Books
             </h2>
             <p className="text-sm text-gray-500 italic">Will automatically list books related to this concept.</p>
          </section>
          
          <section className="space-y-3">
             <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
               <PenTool className="w-4 h-4 text-gray-400" /> Research & Writing
             </h2>
             <p className="text-sm text-gray-500 italic">Outputs linked to this node.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
