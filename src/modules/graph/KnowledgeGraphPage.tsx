import { useEffect, useRef, useState, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Search, Network, Maximize, List, Book, FileText, Briefcase, PenTool, Hash, X, ArrowRight, User, Sparkles, Zap, RefreshCw, CheckCircle2 } from "lucide-react"
import * as d3 from "d3"
import { useKnowledgeGraph } from "../../hooks/useKnowledgeGraph"
import { useNotesStore } from "../../store/notesStore"
import { useWritingStore } from "../../store/writingStore"
import { useProjectsStore } from "../../store/projectsStore"
import { useLibraryStore } from "../../store/libraryStore"
import { useKnowledgeStore } from "../../store/knowledgeStore"
import { useToastStore } from "../../store/toastStore"
import { runAutoLinker, getAutoLinkedRelationsForEntity, autoLinkSingleEntity } from "../../utils/autoLinker"
import { cn } from "../../utils/cn"
import { MarkdownRenderer } from "../../components/ui/MarkdownRenderer"

import { ProvenanceBadge } from "../../components/ui/ProvenanceBadge"

import { ErrorBoundary } from "../../components/ErrorBoundary"

export function KnowledgeGraphPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  const { nodes: rawNodes, edges: rawEdges } = useKnowledgeGraph();
  const addToast = useToastStore(state => state.addToast);
  const [isLinking, setIsLinking] = useState(false);
  
  // App Stores for details
  const notes = useNotesStore(state => state.notes)
  const drafts = useWritingStore(state => state.drafts)
  const projects = useProjectsStore(state => state.projects)
  const books = useLibraryStore(state => state.books)
  const concepts = useKnowledgeStore(state => state.concepts)
  const storedRelations = useKnowledgeStore(state => state.relations)
  
  // State
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    note: true,
    writing: true,
    project: true,
    concept: true,
    book: true,
    author: true,
    source_fragment: true
  } as Record<string, boolean>)

  const handleRunAutoLinker = () => {
    setIsLinking(true);
    const toastId = addToast({ type: 'loading', message: 'Menganalisis & menautkan seluruh node pengetahuan...' });
    
    setTimeout(() => {
      try {
        const result = runAutoLinker();
        if (result.newAdded > 0) {
          addToast({
            type: 'success',
            message: `Berhasil menemukan ${result.totalDiscovered} keterkaitan dan menambahkan ${result.newAdded} relasi otomatis!`
          });
        } else {
          addToast({
            type: 'info',
            message: `Seluruh ${result.totalDiscovered} keterkaitan pengetahuan sudah tertaut dengan sinkron.`
          });
        }
      } catch (err: any) {
        addToast({ type: 'error', message: 'Gagal menjalankan penautan otomatis.' });
      } finally {
        setIsLinking(false);
      }
    }, 400);
  };


  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchTerm(search);
      setTimeout(() => {
         const exactMatch = rawNodes.find(n => n.label.toLowerCase() === search.toLowerCase());
         if (exactMatch) setSelectedNodeId(exactMatch.id);
      }, 500);
    }
  }, [searchParams, rawNodes]);

  
  // Filtered Data
  const { nodes, edges } = useMemo(() => {
    let filteredNodes = rawNodes.filter(n => filters[n.type as keyof typeof filters]);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    let filteredEdges = rawEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [rawNodes, rawEdges, filters]);

  // Node Selection
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId])
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
      .map(e => {
        const isOutgoing = e.source === selectedNodeId;
        const connectedId = isOutgoing ? e.target : e.source;
        const node = nodes.find(n => n.id === connectedId);
        
        const relation = storedRelations.find(r => 
          (r.sourceNodeId === e.source && r.targetNodeId === e.target && r.relationType === e.label)
        );
        
        return {
          node,
          edgeLabel: e.label,
          direction: isOutgoing ? ('outgoing' as const) : ('incoming' as const),
          relation
        };
      }).filter(item => Boolean(item.node));
  }, [edges, nodes, selectedNodeId, storedRelations])

  // Quick auto-link single node
  const handleAutoLinkSelectedNode = () => {
    if (!selectedNode) return;
    let text = "";
    if (selectedNode.type === 'note') {
      const n = notes.find(x => x.id === selectedNode.id);
      if (n) text = `${n.title}\n${n.content}`;
    } else if (selectedNode.type === 'writing') {
      const d = drafts.find(x => x.id === selectedNode.id);
      if (d) text = `${d.title}\n${d.content}`;
    } else if (selectedNode.type === 'project') {
      const p = projects.find(x => x.id === selectedNode.id);
      if (p) text = `${p.title}\n${p.description}`;
    } else if (selectedNode.type === 'concept') {
      const c = concepts.find(x => x.id === selectedNode.id);
      if (c) text = `${c.name}\n${c.definition}\n${c.aliases.join(' ')}`;
    }

    if (!text) {
      addToast({ type: 'info', message: 'Teks tidak mencukupi untuk pemindaian otomatis.' });
      return;
    }

    const added = autoLinkSingleEntity(selectedNode.id, text, selectedNode.type, selectedNode.label);
    if (added > 0) {
      addToast({ type: 'success', message: `Berhasil menambahkan ${added} relasi baru untuk "${selectedNode.label}"!` });
    } else {
      addToast({ type: 'info', message: `Seluruh relasi untuk "${selectedNode.label}" sudah optimal.` });
    }
  };

  // Get rich data for selected node
  const nodeDetails = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'note') {
      return notes.find(n => n.id === selectedNode.id);
    }
    if (selectedNode.type === 'writing') {
      return drafts.find(d => d.id === selectedNode.id);
    }
    if (selectedNode.type === 'project') {
      return projects.find(p => p.id === selectedNode.id);
    }
    if (selectedNode.type === 'book') {
      return books.find(b => b.id === selectedNode.id);
    }
    return null;
  }, [selectedNode, notes, drafts, projects, books]);

  useEffect(() => {
    if (viewMode !== 'graph') return;
    if (!svgRef.current || !wrapperRef.current) return
    if (nodes.length === 0) return

    const width = wrapperRef.current.clientWidth
    const height = wrapperRef.current.clientHeight
    const svg = d3.select(svgRef.current)
    
    svg.selectAll("*").remove() 
    svg.attr("width", width).attr("height", height)

    // Setup markers
    const markerColors: Record<string, string> = {
      default: "#9ca3af",
      contradicts: "#111827",
      supports: "#4b5563",
      expands_on: "#6b7280"
    };

    Object.entries(markerColors).forEach(([key, color]) => {
      svg.append("defs").append("marker")
        .attr("id", `arrowhead-${key}`)
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 25)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5")
        .attr("fill", color)
        .style("stroke", "none");
    });

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => {
        g.attr("transform", e.transform)
      })
      
    svg.call(zoom)
    
    const g = svg.append("g")

    // Copy data
    const graphNodes = nodes.map(d => ({ ...d, x: Math.random() * width, y: Math.random() * height }))
    const graphLinks = edges.map(d => ({ ...d }))

    const simulation = d3.forceSimulation(graphNodes as any)
      .force("link", d3.forceLink(graphLinks).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.type === 'concept' ? 40 : 30).iterations(2))

    // Edges
    const linkGroup = g.append("g")
      .selectAll("g")
      .data(graphLinks)
      .join("g")

    const link = linkGroup.append("line")
      .attr("stroke", (d: any) => {
        if (d.label === 'contradicts') return markerColors.contradicts;
        if (d.label === 'supports') return markerColors.supports;
        if (d.label === 'expands_on') return markerColors.expands_on;
        return "#e5e7eb";
      })
      .attr("stroke-opacity", (d: any) => {
        if (d.createdBy === 'ai_agent' && !d.verifiedBySystem) {
          const score = typeof d.confidenceScore === 'number' ? d.confidenceScore : 0.7;
          return Math.max(0.25, score * 0.45);
        }
        return 0.7;
      })
      .attr("stroke-width", (d: any) => {
        if (d.createdBy === 'ai_agent' && !d.verifiedBySystem) {
          return 1.2;
        }
        return d.label ? 2 : 1.5;
      })
      .attr("stroke-dasharray", (d: any) => {
        if (d.createdBy === 'ai_agent' && !d.verifiedBySystem) {
          return "4,4";
        }
        return "none";
      })
      .attr("marker-end", (d: any) => {
        if (d.label === 'contradicts') return `url(#arrowhead-contradicts)`;
        if (d.label === 'supports') return `url(#arrowhead-supports)`;
        if (d.label === 'expands_on') return `url(#arrowhead-expands_on)`;
        return `url(#arrowhead-default)`;
      });

    // Edge Labels
    const linkText = linkGroup.append("text")
      .attr("fill", (d: any) => {
        if (d.label === 'contradicts') return markerColors.contradicts;
        if (d.label === 'supports') return markerColors.supports;
        if (d.label === 'expands_on') return markerColors.expands_on;
        return "#9ca3af";
      })
      .attr("font-size", "10px")
      .attr("dy", -4)
      .attr("text-anchor", "middle")
      .text((d: any) => d.label || "");

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(graphNodes)
      .join("g")
      .attr("class", "cursor-pointer")
      .call(drag(simulation) as any)
      .on("click", (event, d: any) => {
         setSelectedNodeId(d.id)
      })

    // Node circles
    node.append("circle")
      .attr("r", (d: any) => {
        const isSelected = d.id === selectedNodeId;
        const baseR = d.type === 'concept' ? 24 : 18;
        return isSelected ? baseR + 4 : baseR;
      })
      .attr("fill", (d: any) => {
        const isMatched = searchTerm && d.label.toLowerCase().includes(searchTerm.toLowerCase());
        if (searchTerm && !isMatched) return '#f3f4f6'; // dim
        
        switch(d.type) {
          case 'note': return '#111827'    // Slate 900
          case 'writing': return '#374151' // Slate 700
          case 'project': return '#1f2937' // Slate 800
          case 'book': return '#4b5563'    // Slate 600
          case 'concept': return '#6b7280' // Slate 500
          case 'author': return '#9ca3af'  // Slate 400
          default: return '#6b7280'
        }
      })
      .attr("stroke", (d: any) => {
        if (d.id === selectedNodeId) return "#111827"; // Dark stroke for selected
        const isMatched = searchTerm && d.label.toLowerCase().includes(searchTerm.toLowerCase());
        return isMatched ? "#111827" : "#ffffff";
      })
      .attr("stroke-width", (d: any) => {
        if (d.id === selectedNodeId) return 4;
        const isMatched = searchTerm && d.label.toLowerCase().includes(searchTerm.toLowerCase());
        return isMatched ? 3 : 2;
      })
      .attr("class", "transition-all duration-200")

    // Node icons/text
    node.append("text")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("font-family", "FontAwesome")
      .attr("fill", "#ffffff")
      .attr("font-size", (d: any) => d.type === 'concept' ? "18px" : "14px")
      .text((d: any) => {
         // Fallback to text initials if icon isn't loaded or we just want text
         return d.label.substring(0, 1).toUpperCase();
      })

    // Node Labels (external)
    node.append("text")
      .attr("dy", (d: any) => (d.type === 'concept' ? 42 : 34))
      .attr("text-anchor", "middle")
      .attr("fill", (d: any) => {
        const isMatched = searchTerm && d.label.toLowerCase().includes(searchTerm.toLowerCase());
        if (searchTerm && !isMatched) return '#d1d5db';
        return d.id === selectedNodeId ? '#111827' : '#4b5563';
      })
      .attr("font-size", (d: any) => d.id === selectedNodeId ? "14px" : "12px")
      .attr("font-weight", (d: any) => d.id === selectedNodeId ? "700" : "500")
      .text((d: any) => {
         if (d.label.length > 20) return d.label.substring(0, 20) + '...';
         return d.label;
      })
      .style("pointer-events", "none")
      
    // Initial Zoom to fit
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(width/2, height/2).scale(0.8).translate(-width/2, -height/2))

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => Math.max(20, Math.min(width - 20, d.source.x)))
        .attr("y1", (d: any) => Math.max(20, Math.min(height - 20, d.source.y)))
        .attr("x2", (d: any) => Math.max(20, Math.min(width - 20, d.target.x)))
        .attr("y2", (d: any) => Math.max(20, Math.min(height - 20, d.target.y)))
        
      node
        .attr("transform", (d: any) => {
          d.x = Math.max(30, Math.min(width - 30, d.x))
          d.y = Math.max(30, Math.min(height - 30, d.y))
          return `translate(${d.x},${d.y})`
        })
    })

    function drag(simulation: any) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      }
      function dragged(event: any) {
        event.subject.fx = event.x
        event.subject.fy = event.y
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      }
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    }

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, searchTerm, viewMode, selectedNodeId])

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }
  
  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'note': return <FileText className="w-4 h-4 text-gray-900" />
      case 'writing': return <PenTool className="w-4 h-4 text-gray-900" />
      case 'project': return <Briefcase className="w-4 h-4 text-gray-900" />
      case 'concept': return <Hash className="w-4 h-4 text-gray-900" />
      case 'book': return <Book className="w-4 h-4 text-gray-900" />
      case 'author': return <User className="w-4 h-4 text-gray-900" />
      default: return <Network className="w-4 h-4 text-gray-600" />
    }
  }

  const navigateToDetail = () => {
    if (!selectedNode) return;
    
    if (selectedNode.type === 'note' && notes.find(n => n.id === selectedNode.id)) {
      navigate(`/notes/${selectedNode.id}`)
    } else if (selectedNode.type === 'writing' && drafts.find(d => d.id === selectedNode.id)) {
      navigate(`/writing/${selectedNode.id}`)
    } else if (selectedNode.type === 'project' && projects.find(p => p.id === selectedNode.id)) {
      navigate(`/projects/${selectedNode.id}`)
    } else if (selectedNode.type === 'book' && books.find(b => b.id === selectedNode.id)) {
      navigate(`/library/${selectedNode.id}`)
    } else {
      navigate(`/graph/${selectedNode.id}`)
    }
  }

  return (
    <ErrorBoundary fallbackMessage="Gagal merender Graf Pengetahuan — coba gunakan Filter Tipe Simpul untuk mengurangi jumlah data.">
      <div className="flex flex-col h-[calc(100vh-13rem)] md:h-[calc(100vh-8rem)] min-h-[460px] md:min-h-[600px] animate-in fade-in duration-500 w-full min-w-0 max-w-7xl mx-auto pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shrink-0 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-display">Knowledge Graph</h1>
          <p className="text-gray-500 mt-0.5 text-xs sm:text-sm">Visualisasi & penautan otomatis antar catatan, konsep, dan pustaka.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button 
            variant="outline" 
            onClick={handleRunAutoLinker} 
            disabled={isLinking}
            className="gap-2 h-9 border-gray-300 text-gray-900 hover:bg-gray-100 font-medium"
            title="Pindai dan tautkan otomatis seluruh relasi pengetahuan"
          >
            <Sparkles className={cn("w-4 h-4 text-gray-900", isLinking && "animate-spin")} />
            <span>{isLinking ? "Menautkan..." : "Tautkan Otomatis"}</span>
          </Button>

          <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
            <button onClick={() => setViewMode('graph')} className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'graph' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700')}>
               <Network className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded-lg transition-colors", viewMode === 'list' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700')}>
               <List className="w-4 h-4" />
            </button>
          </div>
          <Button variant="outline" className="gap-2 shrink-0 h-9" onClick={() => {
            if (wrapperRef.current?.requestFullscreen) {
              wrapperRef.current.requestFullscreen();
            }
          }}>
            <Maximize className="w-4 h-4" />
            <span className="hidden sm:inline">Layar Penuh</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left Side: Graph / List */}
        <div ref={wrapperRef} className="flex-1 flex flex-col min-w-0 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative">
          
          {/* Toolbar Overlay (Graph Mode) */}
          {viewMode === 'graph' && (
            <div className="absolute top-3 left-3 right-3 z-10 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl p-1.5 shadow-sm pointer-events-auto shrink-0">
                <button onClick={() => toggleFilter('note')} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-all whitespace-nowrap", filters.note ? "bg-gray-900 text-white font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-100")}>
                  <FileText className="w-3.5 h-3.5" /> <span>Catatan</span>
                </button>
                <button onClick={() => toggleFilter('writing')} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-all whitespace-nowrap", filters.writing ? "bg-gray-900 text-white font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-100")}>
                  <PenTool className="w-3.5 h-3.5" /> <span>Tulisan</span>
                </button>
                <button onClick={() => toggleFilter('project')} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-all whitespace-nowrap", filters.project ? "bg-gray-900 text-white font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-100")}>
                  <Briefcase className="w-3.5 h-3.5" /> <span>Proyek</span>
                </button>
                <button onClick={() => toggleFilter('concept')} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-all whitespace-nowrap", filters.concept ? "bg-gray-900 text-white font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-100")}>
                  <Hash className="w-3.5 h-3.5" /> <span>Konsep</span>
                </button>
                <button onClick={() => toggleFilter('book')} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-all whitespace-nowrap", filters.book ? "bg-gray-900 text-white font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-100")}>
                  <Book className="w-3.5 h-3.5" /> <span>Pustaka</span>
                </button>
                <button onClick={() => toggleFilter('author')} className={cn("px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-all whitespace-nowrap", filters.author ? "bg-gray-900 text-white font-semibold" : "bg-transparent text-gray-600 hover:bg-gray-100")}>
                  <User className="w-3.5 h-3.5" /> <span>Penulis</span>
                </button>
              </div>
              
              <div className="flex items-center bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl px-3 py-1.5 w-full sm:w-56 shadow-sm pointer-events-auto">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                    type="text"
                    placeholder="Cari node..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full ml-2 text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
          )}

          {nodes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-400 border border-gray-100">
                <Network className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Grafik Kosong</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">
                Tambahkan catatan atau pustaka dengan tag (contoh: #konsep) untuk mulai membangun grafik pengetahuan Anda.
              </p>
            </div>
          ) : viewMode === 'graph' ? (
            <div className="flex-1 relative w-full h-full bg-gray-50/50" ref={wrapperRef}>
              <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-medium">Node</th>
                    <th className="px-6 py-4 font-medium">Tipe</th>
                    <th className="px-6 py-4 font-medium">Koneksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nodes
                    .filter(n => !searchTerm || n.label.toLowerCase().includes(searchTerm.toLowerCase()))
                    .sort((a,b) => {
                      const aConn = edges.filter(e => e.source === a.id || e.target === a.id).length;
                      const bConn = edges.filter(e => e.source === b.id || e.target === b.id).length;
                      return bConn - aConn;
                    })
                    .map(node => {
                      const connections = edges.filter(e => e.source === node.id || e.target === node.id).length;
                      return (
                        <tr key={node.id} onClick={() => setSelectedNodeId(node.id)} className={cn("bg-white hover:bg-gray-50/50 cursor-pointer transition-colors", selectedNodeId === node.id && "bg-gray-50")}>
                          <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                            {getTypeIcon(node.type)}
                            {node.label}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider rounded-md",
                              node.type === 'concept' ? 'bg-gray-100 text-gray-800' :
                              node.type === 'book' ? 'bg-gray-100 text-gray-800' :
                              node.type === 'note' ? 'bg-gray-100 text-gray-800' :
                              node.type === 'author' ? 'bg-gray-100 text-gray-800' :
                              'bg-gray-100 text-gray-700'
                            )}>
                              {node.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {connections} relasi
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Details Panel */}
        {selectedNode && (
          <div className="fixed inset-x-0 bottom-16 sm:bottom-20 lg:static z-40 lg:z-auto bg-white border-t lg:border border-gray-200 rounded-t-2xl lg:rounded-2xl shadow-2xl lg:shadow-sm flex flex-col h-[52vh] lg:h-auto w-full lg:w-80 xl:w-96 shrink-0 animate-in slide-in-from-bottom-4 lg:slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {getTypeIcon(selectedNode.type)}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{selectedNode.type}</span>
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedNode.label}</h2>
              
              {nodeDetails && (nodeDetails as any).content && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pratinjau</h3>
                  <div className="text-sm text-gray-600 line-clamp-5">
                    <MarkdownRenderer className="prose-sm">{((nodeDetails as any).content)}</MarkdownRenderer>
                  </div>
                </div>
              )}
              
              {nodeDetails && (nodeDetails as any).description && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Deskripsi</h3>
                  <div className="text-sm text-gray-600">
                    {((nodeDetails as any).description)}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Relasi Terhubung ({selectedNodeConnections.length})
                  </h3>
                  <button 
                    onClick={handleAutoLinkSelectedNode}
                    className="text-xs text-gray-900 hover:text-black font-semibold flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition-colors"
                    title="Pindai dan tautkan otomatis entitas yang disebut dalam node ini"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Tautkan Node</span>
                  </button>
                </div>

                {selectedNodeConnections.length === 0 ? (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-xs text-gray-500">Belum ada relasi terdaftar.</p>
                    <button 
                      onClick={handleAutoLinkSelectedNode}
                      className="mt-2 text-xs font-semibold text-gray-900 underline"
                    >
                      Pindai otomatis sekarang
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedNodeConnections.slice(0, 10).map((conn, idx) => (
                      <button 
                        key={`${conn.node?.id}-${idx}`} 
                        onClick={() => setSelectedNodeId(conn.node!.id)} 
                        className="flex flex-col p-2.5 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50/70 transition-all text-left group bg-white shadow-2xs"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full mb-1 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {getTypeIcon(conn.node!.type)}
                            <span className="text-sm text-gray-900 font-medium truncate group-hover:text-black">
                              {conn.node?.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md shrink-0",
                              conn.edgeLabel === 'contradicts' ? 'bg-gray-200 text-gray-900' :
                              conn.edgeLabel === 'supports' ? 'bg-gray-200 text-gray-900' :
                              'bg-gray-100 text-gray-700'
                            )}>
                              {conn.edgeLabel ? conn.edgeLabel.replace('_', ' ') : (conn.direction === 'outgoing' ? 'menautkan' : 'ditautkan')}
                            </span>
                            {conn.relation && <ProvenanceBadge relation={conn.relation} />}
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-400 capitalize pl-6">
                          Tipe: {conn.node?.type} ({conn.direction === 'outgoing' ? 'arah keluar' : 'arah masuk'})
                        </span>
                      </button>
                    ))}
                    {selectedNodeConnections.length > 10 && (
                      <p className="text-xs text-gray-400 text-center pt-2">+{selectedNodeConnections.length - 10} relasi lainnya</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <Button onClick={navigateToDetail} className="w-full gap-2 bg-gray-900 hover:bg-gray-800">
                Buka Selengkapnya <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </ErrorBoundary>
  )
}
