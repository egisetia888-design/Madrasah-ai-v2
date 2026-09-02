import { useNotesStore } from "../store/notesStore";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { useLibraryStore } from "../store/libraryStore";
import { useWritingStore } from "../store/writingStore";
import { useProjectsStore } from "../store/projectsStore";
import { useCurriculumStore } from "../store/curriculumStore";
import { useReviewStore } from "../store/reviewStore";
import { RelationType, NodeType, UUID } from "../types";

export interface DetectedEntity {
  id: string;
  label: string;
  type: NodeType;
  matchedText: string;
  relationType: RelationType;
  confidence: number;
}

export interface AutoLinkSummary {
  totalDiscovered: number;
  newAdded: number;
  relations: Array<{
    sourceId: string;
    sourceLabel: string;
    sourceType: NodeType;
    targetId: string;
    targetLabel: string;
    targetType: NodeType;
    relationType: RelationType;
    explanation: string;
  }>;
}

// Stop words to avoid false positive linking on small common terms
const STOP_WORDS = new Set([
  'dan', 'atau', 'yang', 'untuk', 'dengan', 'pada', 'dari', 'ke', 'ini', 'itu', 
  'ada', 'bisa', 'juga', 'oleh', 'karena', 'maka', 'dalam', 'tentang', 'seperti',
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'have', 'been',
  'all', 'not', 'can', 'will', 'are', 'was', 'were', 'page', 'buku', 'bab', 'item'
]);

/**
 * Normalizes string for fuzzy token matching
 */
function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Scans a text fragment against all existing system entities to find mentions automatically.
 */
export function scanTextForEntities(text: string, currentEntityId?: string): DetectedEntity[] {
  if (!text || text.length < 2) return [];

  const notes = useNotesStore.getState().notes;
  const concepts = useKnowledgeStore.getState().concepts;
  const books = useLibraryStore.getState().books;
  const authors = useLibraryStore.getState().authors;
  const drafts = useWritingStore.getState().drafts;
  const projects = useProjectsStore.getState().projects;
  const competencies = useCurriculumStore.getState().competencies;

  const results: DetectedEntity[] = [];
  const addedIds = new Set<string>();

  if (currentEntityId) {
    addedIds.add(currentEntityId);
  }

  // 1. Explicit [[WikiLinks]] extraction
  const wikilinks: string[] = text.match(/\[\[(.*?)\]\]/g) || [];
  wikilinks.forEach(wl => {
    const raw = wl.slice(2, -2).trim();
    if (!raw) return;

    // Look up in notes
    const note = notes.find(n => n.title.toLowerCase() === raw.toLowerCase());
    if (note && !addedIds.has(note.id)) {
      addedIds.add(note.id);
      results.push({
        id: note.id,
        label: note.title,
        type: 'note',
        matchedText: wl,
        relationType: 'references',
        confidence: 1.0
      });
      return;
    }

    // Look up in concepts
    const concept = concepts.find(c => c.name.toLowerCase() === raw.toLowerCase() || c.aliases.some(a => a.toLowerCase() === raw.toLowerCase()));
    if (concept && !addedIds.has(concept.id)) {
      addedIds.add(concept.id);
      results.push({
        id: concept.id,
        label: concept.name,
        type: 'concept',
        matchedText: wl,
        relationType: 'defines',
        confidence: 1.0
      });
      return;
    }

    // Look up in books
    const book = books.find(b => b.title.toLowerCase() === raw.toLowerCase());
    if (book && !addedIds.has(book.id)) {
      addedIds.add(book.id);
      results.push({
        id: book.id,
        label: book.title,
        type: 'book',
        matchedText: wl,
        relationType: 'references',
        confidence: 1.0
      });
    }
  });

  // 2. Exact & Keyword Mention Scanner
  const lowerText = text.toLowerCase();

  // Scan Concepts (highest priority for knowledge atomicity)
  concepts.forEach(c => {
    if (addedIds.has(c.id)) return;
    const cName = c.name.toLowerCase().trim();
    if (cName.length >= 3 && !STOP_WORDS.has(cName)) {
      const regex = new RegExp(`\\b${escapeRegExp(cName)}\\b`, 'i');
      if (regex.test(lowerText)) {
        addedIds.add(c.id);
        results.push({
          id: c.id,
          label: c.name,
          type: 'concept',
          matchedText: c.name,
          relationType: 'expands_on',
          confidence: 0.95
        });
        return;
      }
    }
    // Check aliases
    for (const alias of c.aliases) {
      const aLower = alias.toLowerCase().trim();
      if (aLower.length >= 3 && !STOP_WORDS.has(aLower)) {
        const regex = new RegExp(`\\b${escapeRegExp(aLower)}\\b`, 'i');
        if (regex.test(lowerText)) {
          addedIds.add(c.id);
          results.push({
            id: c.id,
            label: c.name,
            type: 'concept',
            matchedText: alias,
            relationType: 'expands_on',
            confidence: 0.9
          });
          break;
        }
      }
    }
  });

  // Scan Books
  books.forEach(b => {
    if (addedIds.has(b.id)) return;
    const bTitle = b.title.toLowerCase().trim();
    if (bTitle.length >= 4 && !STOP_WORDS.has(bTitle)) {
      const regex = new RegExp(`\\b${escapeRegExp(bTitle)}\\b`, 'i');
      if (regex.test(lowerText)) {
        addedIds.add(b.id);
        results.push({
          id: b.id,
          label: b.title,
          type: 'book',
          matchedText: b.title,
          relationType: 'references',
          confidence: 0.9
        });
      }
    }
  });

  // Scan Authors
  authors.forEach(a => {
    if (addedIds.has(a.id)) return;
    const aName = a.name.toLowerCase().trim();
    if (aName.length >= 4 && !STOP_WORDS.has(aName)) {
      const regex = new RegExp(`\\b${escapeRegExp(aName)}\\b`, 'i');
      if (regex.test(lowerText)) {
        addedIds.add(a.id);
        results.push({
          id: a.id,
          label: a.name,
          type: 'author',
          matchedText: a.name,
          relationType: 'references',
          confidence: 0.85
        });
      }
    }
  });

  // Scan Other Notes
  notes.forEach(n => {
    if (addedIds.has(n.id)) return;
    const nTitle = n.title.toLowerCase().trim();
    if (nTitle.length >= 4 && !STOP_WORDS.has(nTitle)) {
      const regex = new RegExp(`\\b${escapeRegExp(nTitle)}\\b`, 'i');
      if (regex.test(lowerText)) {
        addedIds.add(n.id);
        results.push({
          id: n.id,
          label: n.title,
          type: 'note',
          matchedText: n.title,
          relationType: 'supports',
          confidence: 0.88
        });
      }
    }
  });

  // Scan Projects
  projects.forEach(p => {
    if (addedIds.has(p.id)) return;
    const pTitle = p.title.toLowerCase().trim();
    if (pTitle.length >= 4 && !STOP_WORDS.has(pTitle)) {
      const regex = new RegExp(`\\b${escapeRegExp(pTitle)}\\b`, 'i');
      if (regex.test(lowerText)) {
        addedIds.add(p.id);
        results.push({
          id: p.id,
          label: p.title,
          type: 'project',
          matchedText: p.title,
          relationType: 'applies',
          confidence: 0.85
        });
      }
    }
  });

  // Scan Drafts
  drafts.forEach(d => {
    if (addedIds.has(d.id)) return;
    const dTitle = d.title.toLowerCase().trim();
    if (dTitle.length >= 4 && !STOP_WORDS.has(dTitle)) {
      const regex = new RegExp(`\\b${escapeRegExp(dTitle)}\\b`, 'i');
      if (regex.test(lowerText)) {
        addedIds.add(d.id);
        results.push({
          id: d.id,
          label: d.title,
          type: 'writing',
          matchedText: d.title,
          relationType: 'references',
          confidence: 0.85
        });
      }
    }
  });

  return results;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Runs the global automated knowledge linker across the entire database.
 * Computes all implicit relations and synchronizes them into the Knowledge Store.
 */
export function runAutoLinker(): AutoLinkSummary {
  const notes = useNotesStore.getState().notes;
  const concepts = useKnowledgeStore.getState().concepts;
  const fragments = useKnowledgeStore.getState().sourceFragments;
  const existingRelations = useKnowledgeStore.getState().relations;
  const addRelation = useKnowledgeStore.getState().addRelation;
  
  const books = useLibraryStore.getState().books;
  const authors = useLibraryStore.getState().authors;
  const drafts = useWritingStore.getState().drafts;
  const projects = useProjectsStore.getState().projects;
  const competencies = useCurriculumStore.getState().competencies;
  const decks = useReviewStore.getState().decks;

  const existingPairs = new Set(
    existingRelations.map(r => `${r.sourceNodeId}->${r.targetNodeId}`)
  );

  const discoveredRelations: Array<{
    sourceId: string;
    sourceLabel: string;
    sourceType: NodeType;
    targetId: string;
    targetLabel: string;
    targetType: NodeType;
    relationType: RelationType;
    explanation: string;
  }> = [];

  let newAddedCount = 0;

  const registerLink = (
    sourceId: string,
    sourceLabel: string,
    sourceType: NodeType,
    targetId: string,
    targetLabel: string,
    targetType: NodeType,
    relationType: RelationType,
    explanation: string
  ) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const key = `${sourceId}->${targetId}`;
    
    discoveredRelations.push({
      sourceId,
      sourceLabel,
      sourceType,
      targetId,
      targetLabel,
      targetType,
      relationType,
      explanation
    });

    if (!existingPairs.has(key)) {
      existingPairs.add(key);
      addRelation({
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        relationType,
        confidenceScore: 0.95,
        createdBy: 'ai_agent',
        explanation,
        verifiedBySystem: false
      });
      newAddedCount++;
    }
  };

  // 1. Process Notes
  notes.forEach(note => {
    // Note to Book (explicit source)
    if (note.sourceId) {
      const book = books.find(b => b.id === note.sourceId);
      if (book) {
        registerLink(note.id, note.title, 'note', book.id, book.title, 'book', 'references', 'Catatan ini merujuk ke buku sumber');
      }
    }

    // Note content scanning
    const entities = scanTextForEntities(`${note.title}\n${note.content}\n${note.rawQuote || ''}`, note.id);
    entities.forEach(ent => {
      registerLink(note.id, note.title, 'note', ent.id, ent.label, ent.type, ent.relationType, `Ditemukan penyebutan otomatis pada teks: "${ent.matchedText}"`);
    });
  });

  // 2. Process Concepts
  concepts.forEach(concept => {
    const textToScan = `${concept.name}\n${concept.definition}\n${concept.aliases.join(' ')}`;
    const entities = scanTextForEntities(textToScan, concept.id);
    entities.forEach(ent => {
      registerLink(concept.id, concept.name, 'concept', ent.id, ent.label, ent.type, ent.relationType, `Konsep ini terhubung secara semantik dengan "${ent.label}"`);
    });
  });

  // 3. Process Books & Authors
  books.forEach(book => {
    if (book.authorId) {
      const author = authors.find(a => a.id === book.authorId);
      if (author) {
        registerLink(book.id, book.title, 'book', author.id, author.name, 'author', 'references', `Buku ditulis oleh ${author.name}`);
      }
    }
  });

  // 4. Process Source Fragments
  fragments.forEach(frag => {
    if (frag.sourceId) {
      const book = books.find(b => b.id === frag.sourceId);
      if (book) {
        registerLink(frag.id, `Kutipan: ${frag.quote.slice(0, 30)}...`, 'source_fragment', book.id, book.title, 'book', 'references', 'Fragmen diekstrak langsung dari buku');
      }
    }
    const entities = scanTextForEntities(frag.quote, frag.id);
    entities.forEach(ent => {
      registerLink(frag.id, `Kutipan: ${frag.quote.slice(0, 30)}...`, 'source_fragment', ent.id, ent.label, ent.type, ent.relationType, `Kutipan menyebutkan "${ent.label}"`);
    });
  });

  // 5. Process Drafts
  drafts.forEach(draft => {
    const entities = scanTextForEntities(`${draft.title}\n${draft.content}`, draft.id);
    entities.forEach(ent => {
      registerLink(draft.id, draft.title, 'writing', ent.id, ent.label, ent.type, ent.relationType, `Draf tulisan mengadopsi rujukan "${ent.label}"`);
    });
  });

  // 6. Process Projects
  projects.forEach(project => {
    const entities = scanTextForEntities(`${project.title}\n${project.description}`, project.id);
    entities.forEach(ent => {
      registerLink(project.id, project.title, 'project', ent.id, ent.label, ent.type, ent.relationType, `Proyek ini mengimplementasikan "${ent.label}"`);
    });
  });

  // 7. Process Competencies
  competencies.forEach(comp => {
    if (comp.bookIds && comp.bookIds.length > 0) {
      comp.bookIds.forEach(bId => {
        const book = books.find(b => b.id === bId);
        if (book) {
          registerLink(comp.id, comp.title, 'concept', book.id, book.title, 'book', 'references', 'Buku kurikulum untuk kompetensi');
        }
      });
    }
    const entities = scanTextForEntities(comp.title, comp.id);
    entities.forEach(ent => {
      registerLink(comp.id, comp.title, 'concept', ent.id, ent.label, ent.type, ent.relationType, `Kompetensi mempelajari "${ent.label}"`);
    });
  });

  // 8. Process Decks
  decks.forEach(deck => {
    if (deck.noteId) {
      const note = notes.find(n => n.id === deck.noteId);
      if (note) {
        registerLink(deck.id, deck.name, 'note', note.id, note.title, 'note', 'references', 'Dek review berbasis catatan');
      }
    }
  });

  return {
    totalDiscovered: discoveredRelations.length,
    newAdded: newAddedCount,
    relations: discoveredRelations
  };
}

/**
 * Automatically discovers and adds relations for a single newly created or modified entity.
 */
export function autoLinkSingleEntity(entityId: string, text: string, entityType: NodeType, entityTitle: string): number {
  if (!entityId || !text) return 0;
  const entities = scanTextForEntities(text, entityId);
  const existingRelations = useKnowledgeStore.getState().relations;
  const addRelation = useKnowledgeStore.getState().addRelation;

  const existingPairs = new Set(
    existingRelations.map(r => `${r.sourceNodeId}->${r.targetNodeId}`)
  );

  let count = 0;
  entities.forEach(ent => {
    const key = `${entityId}->${ent.id}`;
    if (!existingPairs.has(key)) {
      existingPairs.add(key);
      addRelation({
        sourceNodeId: entityId,
        targetNodeId: ent.id,
        relationType: ent.relationType,
        confidenceScore: ent.confidence,
        createdBy: 'ai_agent',
        explanation: `Relasi otomatis dari ${entityTitle} ke ${ent.label}`,
        verifiedBySystem: false
      });
      count++;
    }
  });

  return count;
}

/**
 * Creates an explicit directional relation between two specific entities.
 */
export function createExplicitRelation(
  sourceId: string,
  targetId: string,
  relationType: RelationType = 'references',
  explanation?: string
): boolean {
  const existingRelations = useKnowledgeStore.getState().relations;
  const addRelation = useKnowledgeStore.getState().addRelation;
  const exists = existingRelations.some(r => r.sourceNodeId === sourceId && r.targetNodeId === targetId);
  if (!exists) {
    addRelation({
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      relationType,
      confidenceScore: 0.95,
      createdBy: 'user',
      explanation: explanation || `Relasi manual antara entitas`,
      verifiedBySystem: true
    });
    return true;
  }
  return false;
}

/**
 * Returns all direct connections (incoming and outgoing) for a specific entity ID.
 */
export function getAutoLinkedRelationsForEntity(entityId: string) {
  const relations = useKnowledgeStore.getState().relations;
  const notes = useNotesStore.getState().notes;
  const concepts = useKnowledgeStore.getState().concepts;
  const books = useLibraryStore.getState().books;
  const authors = useLibraryStore.getState().authors;
  const drafts = useWritingStore.getState().drafts;
  const projects = useProjectsStore.getState().projects;

  const getEntityInfo = (id: string): { label: string; type: NodeType } => {
    const n = notes.find(x => x.id === id);
    if (n) return { label: n.title, type: 'note' };
    const c = concepts.find(x => x.id === id);
    if (c) return { label: c.name, type: 'concept' };
    const b = books.find(x => x.id === id);
    if (b) return { label: b.title, type: 'book' };
    const a = authors.find(x => x.id === id);
    if (a) return { label: a.name, type: 'author' };
    const d = drafts.find(x => x.id === id);
    if (d) return { label: d.title, type: 'writing' };
    const p = projects.find(x => x.id === id);
    if (p) return { label: p.title, type: 'project' };
    return { label: 'Node', type: 'concept' };
  };

  const outgoing = relations
    .filter(r => r.sourceNodeId === entityId)
    .map(r => ({
      ...r,
      target: getEntityInfo(r.targetNodeId),
      direction: 'outgoing' as const
    }));

  const incoming = relations
    .filter(r => r.targetNodeId === entityId)
    .map(r => ({
      ...r,
      source: getEntityInfo(r.sourceNodeId),
      direction: 'incoming' as const
    }));

  return { outgoing, incoming, total: outgoing.length + incoming.length };
}

