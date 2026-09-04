import { useMemo } from "react";
import { useGraphStore } from "../store/graphStore";
import { useNotesStore } from "../store/notesStore";
import { useWritingStore } from "../store/writingStore";
import { useProjectsStore } from "../store/projectsStore";
import { useLibraryStore } from "../store/libraryStore";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { useCurriculumStore } from "../store/curriculumStore";
import { useReviewStore } from "../store/reviewStore";
import { Node, Edge, Relation, RelationCreator } from "../types";
import { scanTextForEntities } from "../utils/autoLinker";

export function useKnowledgeGraph() {
  const storeNodes = useGraphStore(state => state.nodes);
  const storeEdges = useGraphStore(state => state.edges);
  
  const notes = useNotesStore(state => state.notes);
  const drafts = useWritingStore(state => state.drafts);
  const projects = useProjectsStore(state => state.projects);
  const books = useLibraryStore(state => state.books);
  const authors = useLibraryStore(state => state.authors);
  const competencies = useCurriculumStore(state => state.competencies);
  const decks = useReviewStore(state => state.decks);
  
  const concepts = useKnowledgeStore(state => state.concepts);
  const fragments = useKnowledgeStore(state => state.sourceFragments);
  const relations = useKnowledgeStore(state => state.relations);

  return useMemo(() => {
    const nodes: Node[] = [...storeNodes];
    const edges: Edge[] = [...storeEdges];
    
    const nodeSet = new Set<string>(storeNodes.map(n => n.id));
    const edgeSet = new Set<string>(storeEdges.map(e => e.id));
    
    const addNodeIfMissing = (id: string, label: string, type: Node['type']) => {
      if (!nodeSet.has(id)) {
        nodeSet.add(id);
        nodes.push({ id, label, type });
      }
    };

    const addEdgeIfMissing = (
      source: string,
      target: string,
      label: string,
      verifiedBySystem: boolean = true,
      confidenceScore: number = 1,
      createdBy: RelationCreator = 'user'
    ) => {
      const edgeId = `${source}-${target}`;
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({ id: edgeId, source, target, label, verifiedBySystem, confidenceScore, createdBy });
      }
    };

    const extractTags = (text: string, sourceId: string) => {
      if (!text) return;
      const tags: string[] = text.match(/#[\w-]+/g) || [];
      tags.forEach(tag => {
        const tagId = `tag-${tag.toLowerCase()}`;
        addNodeIfMissing(tagId, tag, 'concept');
        addEdgeIfMissing(sourceId, tagId, 'tags');
      });
    };

    const extractWikilinks = (text: string, sourceId: string) => {
      if (!text) return;
      const matches: string[] = text.match(/\[\[(.*?)\]\]/g) || [];
      matches.forEach(match => {
        const linkText = match.slice(2, -2).trim(); // Remove [[ and ]]
        if (!linkText) return;
        
        // Find existing node by label (case-insensitive)
        const existingNode = nodes.find(n => n.label.toLowerCase() === linkText.toLowerCase());
        const targetId = existingNode ? existingNode.id : `wikilink-${linkText.toLowerCase().replace(/\s+/g, '-')}`;
        
        addNodeIfMissing(targetId, linkText, existingNode ? existingNode.type : 'concept');
        addEdgeIfMissing(sourceId, targetId, 'references');
      });
    };

    // 1. Add all primary entities
    notes.forEach(note => addNodeIfMissing(note.id, note.title, 'note'));
    drafts.forEach(draft => addNodeIfMissing(draft.id, draft.title, 'writing'));
    projects.forEach(project => addNodeIfMissing(project.id, project.title, 'project'));
    books.forEach(book => addNodeIfMissing(book.id, book.title, 'book'));
    authors.forEach(author => addNodeIfMissing(author.id, author.name, 'author'));
    concepts.forEach(concept => addNodeIfMissing(concept.id, concept.name, 'concept'));
    
    fragments.forEach(fragment => {
      const shortQuote = fragment.quote.length > 30 ? fragment.quote.substring(0, 30) + '...' : fragment.quote;
      addNodeIfMissing(fragment.id, `Frg: ${shortQuote}`, 'source_fragment');
    });

    // 2. Add explicit stored relations
    relations.forEach(rel => {
      addEdgeIfMissing(rel.sourceNodeId, rel.targetNodeId, rel.relationType, rel.verifiedBySystem, rel.confidenceScore, rel.createdBy);
    });

    // 3. Extract automatic structural and text mentions
    notes.forEach(note => {
      extractTags(note.content, note.id);
      extractTags(note.title, note.id);
      extractWikilinks(note.content, note.id);
      
      if (note.sourceId) {
        addEdgeIfMissing(note.id, note.sourceId, 'source');
      }

      // Automatic entity scanning
      const autoEntities = scanTextForEntities(`${note.title}\n${note.content}`, note.id);
      autoEntities.forEach(ent => {
        addEdgeIfMissing(note.id, ent.id, ent.relationType);
      });
    });
    
    drafts.forEach(draft => {
      extractTags(draft.content, draft.id);
      extractTags(draft.title, draft.id);
      extractWikilinks(draft.content, draft.id);

      const autoEntities = scanTextForEntities(`${draft.title}\n${draft.content}`, draft.id);
      autoEntities.forEach(ent => {
        addEdgeIfMissing(draft.id, ent.id, ent.relationType);
      });
    });
    
    projects.forEach(project => {
      extractTags(project.description, project.id);
      extractTags(project.title, project.id);
      extractWikilinks(project.description, project.id);

      const autoEntities = scanTextForEntities(`${project.title}\n${project.description}`, project.id);
      autoEntities.forEach(ent => {
        addEdgeIfMissing(project.id, ent.id, ent.relationType);
      });
    });

    books.forEach(book => {
      if (book.authorId) {
        addEdgeIfMissing(book.id, book.authorId, 'authored_by');
      }
    });

    fragments.forEach(fragment => {
      if (fragment.sourceId) {
        addEdgeIfMissing(fragment.id, fragment.sourceId, 'extracted_from');
      }
      const autoEntities = scanTextForEntities(fragment.quote, fragment.id);
      autoEntities.forEach(ent => {
        addEdgeIfMissing(fragment.id, ent.id, ent.relationType);
      });
    });

    concepts.forEach(concept => {
      const autoEntities = scanTextForEntities(`${concept.name}\n${concept.definition}\n${concept.aliases.join(' ')}`, concept.id);
      autoEntities.forEach(ent => {
        addEdgeIfMissing(concept.id, ent.id, ent.relationType);
      });
    });

    competencies.forEach(comp => {
      if (comp.bookIds) {
        comp.bookIds.forEach(bId => {
          addEdgeIfMissing(comp.id, bId, 'studies_book');
        });
      }
      const autoEntities = scanTextForEntities(comp.title, comp.id);
      autoEntities.forEach(ent => {
        addEdgeIfMissing(comp.id, ent.id, ent.relationType);
      });
    });

    decks.forEach(deck => {
      if (deck.noteId) {
        addEdgeIfMissing(deck.id, deck.noteId, 'reviews_note');
      }
    });

    return { nodes, edges };
  }, [storeNodes, storeEdges, notes, drafts, projects, books, authors, concepts, fragments, relations, competencies, decks]);
}

