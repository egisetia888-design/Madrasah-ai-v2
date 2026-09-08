import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where, runTransaction } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebase';
import { Note, Draft, Project, Book, SyncMetadata, Concept, SourceFragment, Relation, LearningPath, Phase, Competency, Deck, Flashcard, ReadingLog } from '../types';
import { useNotesStore } from '../store/notesStore';
import { useWritingStore } from '../store/writingStore';
import { useProjectsStore } from '../store/projectsStore';
import { useLibraryStore } from '../store/libraryStore';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { useCurriculumStore } from '../store/curriculumStore';
import { useReviewStore } from '../store/reviewStore';
import { useSyncStateStore } from '../store/syncStateStore';

function mergeCloudData<T extends { id: string } & SyncMetadata>(
  localItems: T[],
  cloudItems: T[]
): T[] {
  const mergedMap = new Map<string, T>();
  localItems.forEach((n) => mergedMap.set(n.id, n));

  cloudItems.forEach((remoteItem) => {
    const localItem = mergedMap.get(remoteItem.id);
    if (!localItem) {
      mergedMap.set(remoteItem.id, remoteItem);
    } else {
      if (localItem.syncStatus === 'pending_sync' || localItem.syncStatus === 'conflict') {
        if (remoteItem.revision > localItem.revision) {
           mergedMap.set(remoteItem.id, {
             ...localItem,
             syncStatus: 'conflict',
             conflict: {
               detectedAt: Date.now(),
               localRevision: localItem.revision,
               remoteRevision: remoteItem.revision,
               remoteData: remoteItem,
               reason: 'concurrent_edit'
             }
           });
        }
      } else if (remoteItem.revision > localItem.revision) {
         mergedMap.set(remoteItem.id, remoteItem);
      } else if (remoteItem.revision === localItem.revision && localItem.syncStatus !== 'synced') {
         mergedMap.set(remoteItem.id, { ...localItem, syncStatus: 'synced' });
      }
    }
  });
  return Array.from(mergedMap.values());
}

export function initFirestoreSync() {
  if (!isFirebaseConfigured || !auth || !db) {
    useSyncStateStore.getState().setStatus('local_only');
    return;
  }
  const firebaseAuth = auth;
  const firestoreDb = db;

  // Listen to network status
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (firebaseAuth.currentUser) {
        useSyncStateStore.getState().setStatus('syncing');
        setTimeout(() => useSyncStateStore.getState().setStatus('synced'), 800);
      } else {
        useSyncStateStore.getState().setStatus('local_only');
      }
    });

    window.addEventListener('offline', () => {
      useSyncStateStore.getState().setStatus('offline');
    });
  }

  let unsubscribeNotes: (() => void) | null = null;
  let unsubscribeDrafts: (() => void) | null = null;
  let unsubscribeProjects: (() => void) | null = null;
  let unsubscribeBooks: (() => void) | null = null;
  let unsubscribeConcepts: (() => void) | null = null;
  let unsubscribeSourceFragments: (() => void) | null = null;
  let unsubscribeRelations: (() => void) | null = null;
  let unsubscribeLearningPaths: (() => void) | null = null;
  let unsubscribePhases: (() => void) | null = null;
  let unsubscribeCompetencies: (() => void) | null = null;
  let unsubscribeDecks: (() => void) | null = null;
  let unsubscribeFlashcards: (() => void) | null = null;
  let unsubscribeReadingLogs: (() => void) | null = null;

  firebaseAuth.onAuthStateChanged((user) => {
    if (unsubscribeNotes) unsubscribeNotes();
    if (unsubscribeDrafts) unsubscribeDrafts();
    if (unsubscribeProjects) unsubscribeProjects();
    if (unsubscribeBooks) unsubscribeBooks();
    if (unsubscribeConcepts) unsubscribeConcepts();
    if (unsubscribeSourceFragments) unsubscribeSourceFragments();
    if (unsubscribeRelations) unsubscribeRelations();
    if (unsubscribeLearningPaths) unsubscribeLearningPaths();
    if (unsubscribePhases) unsubscribePhases();
    if (unsubscribeCompetencies) unsubscribeCompetencies();
    if (unsubscribeDecks) unsubscribeDecks();
    if (unsubscribeFlashcards) unsubscribeFlashcards();
    if (unsubscribeReadingLogs) unsubscribeReadingLogs();
    
    if (!user) {
      useSyncStateStore.getState().setStatus('local_only');
      return;
    }

    useSyncStateStore.getState().setStatus(navigator.onLine ? 'synced' : 'offline');

    const createUnsubscriber = <T extends { id: string } & SyncMetadata>(
      collectionName: string,
      storeSetter: (merged: T[]) => void,
      storeGetter: () => T[]
    ) => {
      const q = query(collection(firestoreDb, collectionName), where('userId', '==', user.uid));
      return onSnapshot(
        q,
        (snapshot) => {
          const cloudItems: T[] = [];
          snapshot.forEach((docSnap) => cloudItems.push(docSnap.data() as T));
          if (cloudItems.length > 0) {
            storeSetter(mergeCloudData(storeGetter(), cloudItems));
          }
          useSyncStateStore.getState().setLastSyncedAt(Date.now());
        },
        (error) => {
          if (!navigator.onLine) {
            useSyncStateStore.getState().setStatus('offline');
          } else {
            useSyncStateStore.getState().setStatus('error', error?.message || 'Gagal sinkronisasi');
          }
          handleFirestoreError(error, OperationType.GET, collectionName);
        }
      );
    };

    unsubscribeNotes = createUnsubscriber<Note>('notes',
      (merged) => useNotesStore.setState({ notes: merged }),
      () => useNotesStore.getState().notes
    );
    unsubscribeDrafts = createUnsubscriber<Draft>('drafts',
      (merged) => useWritingStore.setState({ drafts: merged }),
      () => useWritingStore.getState().drafts
    );
    unsubscribeProjects = createUnsubscriber<Project>('projects',
      (merged) => useProjectsStore.setState({ projects: merged }),
      () => useProjectsStore.getState().projects
    );
    unsubscribeBooks = createUnsubscriber<Book>('books',
      (merged) => useLibraryStore.setState({ books: merged }),
      () => useLibraryStore.getState().books
    );
    unsubscribeConcepts = createUnsubscriber<Concept>('concepts',
      (merged) => useKnowledgeStore.setState({ concepts: merged }),
      () => useKnowledgeStore.getState().concepts
    );
    unsubscribeSourceFragments = createUnsubscriber<SourceFragment>('sourceFragments',
      (merged) => useKnowledgeStore.setState({ sourceFragments: merged }),
      () => useKnowledgeStore.getState().sourceFragments
    );
    unsubscribeRelations = createUnsubscriber<Relation>('relations',
      (merged) => useKnowledgeStore.setState({ relations: merged }),
      () => useKnowledgeStore.getState().relations
    );
    unsubscribeLearningPaths = createUnsubscriber<LearningPath>('learningPaths',
      (merged) => useCurriculumStore.setState({ paths: merged }),
      () => useCurriculumStore.getState().paths
    );
    unsubscribePhases = createUnsubscriber<Phase>('phases',
      (merged) => useCurriculumStore.setState({ phases: merged }),
      () => useCurriculumStore.getState().phases
    );
    unsubscribeCompetencies = createUnsubscriber<Competency>('competencies',
      (merged) => useCurriculumStore.setState({ competencies: merged }),
      () => useCurriculumStore.getState().competencies
    );
    unsubscribeDecks = createUnsubscriber<Deck>('decks',
      (merged) => useReviewStore.setState({ decks: merged }),
      () => useReviewStore.getState().decks
    );
    unsubscribeFlashcards = createUnsubscriber<Flashcard>('flashcards',
      (merged) => useReviewStore.setState({ flashcards: merged }),
      () => useReviewStore.getState().flashcards
    );
    unsubscribeReadingLogs = createUnsubscriber<ReadingLog>('readingLogs',
      (merged) => useLibraryStore.setState({ readingLogs: merged }),
      () => useLibraryStore.getState().readingLogs || []
    );
  });
}

// Helper untuk OCC
async function syncWithOCC<T extends { id: string } & SyncMetadata>(
  collectionName: string,
  item: T,
  setStateCallback: (id: string, updates: Partial<T>) => void
) {
  if (!isFirebaseConfigured || !auth || !db) return;
  const user = auth.currentUser;
  if (!user) return;
  const path = `${collectionName}/${item.id}`;
  const firestoreDb = db;

  useSyncStateStore.getState().setStatus('syncing');

  try {
    await runTransaction(firestoreDb, async (transaction) => {
      const docRef = doc(firestoreDb, collectionName, item.id);
      const docSnap = await transaction.get(docRef);
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as T;
        if (cloudData.revision >= item.revision && cloudData.revision > 0) {
           setStateCallback(item.id, {
             syncStatus: 'conflict',
             conflict: {
               detectedAt: Date.now(),
               localRevision: item.revision,
               remoteRevision: cloudData.revision,
               remoteData: cloudData,
               reason: 'concurrent_edit'
             }
           } as Partial<T>);
           throw new Error('Conflict detected');
        }
      }
      transaction.set(docRef, { ...item, syncStatus: 'synced', userId: user.uid });
    });

    setStateCallback(item.id, { syncStatus: 'synced' } as Partial<T>);
    useSyncStateStore.getState().setLastSyncedAt(Date.now());
  } catch (err) {
    if (err instanceof Error && err.message === 'Conflict detected') {
      useSyncStateStore.getState().setStatus('synced');
      return;
    }
    setStateCallback(item.id, { syncStatus: 'failed' } as Partial<T>);
    useSyncStateStore.getState().setStatus('error', 'Gagal menyimpan perubahan ke Cloud');
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

async function syncDeleteWithDoc(collectionName: string, id: string) {
  if (!isFirebaseConfigured || !auth || !db) return;
  const user = auth.currentUser;
  if (!user) return;
  const firestoreDb = db;
  useSyncStateStore.getState().setStatus('syncing');
  try {
    await deleteDoc(doc(firestoreDb, collectionName, id));
    useSyncStateStore.getState().setLastSyncedAt(Date.now());
  } catch (err) {
    useSyncStateStore.getState().setStatus('error', 'Gagal menghapus data dari Cloud');
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

export async function syncSaveNote(note: Note) {
  await syncWithOCC('notes', note, (id, updates) => {
    useNotesStore.setState(state => ({
      notes: state.notes.map(n => n.id === id ? { ...n, ...updates } : n)
    }));
  });
}

export async function syncDeleteNote(noteId: string) {
  await syncDeleteWithDoc('notes', noteId);
}

export async function syncSaveDraft(draft: Draft) {
  await syncWithOCC('drafts', draft, (id, updates) => {
    useWritingStore.setState(state => ({
      drafts: state.drafts.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  });
}

export async function syncDeleteDraft(draftId: string) {
  await syncDeleteWithDoc('drafts', draftId);
}

export async function syncSaveProject(project: Project) {
  await syncWithOCC('projects', project, (id, updates) => {
    useProjectsStore.setState(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  });
}

export async function syncDeleteProject(projectId: string) {
  await syncDeleteWithDoc('projects', projectId);
}

export async function syncSaveBook(book: Book) {
  await syncWithOCC('books', book, (id, updates) => {
    useLibraryStore.setState(state => ({
      books: state.books.map(b => b.id === id ? { ...b, ...updates } : b)
    }));
  });
}

export async function syncDeleteBook(bookId: string) {
  await syncDeleteWithDoc('books', bookId);
}

export async function syncSaveConcept(concept: Concept) {
  await syncWithOCC('concepts', concept, (id, updates) => {
    useKnowledgeStore.setState(state => ({
      concepts: state.concepts.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  });
}

export async function syncDeleteConcept(conceptId: string) {
  await syncDeleteWithDoc('concepts', conceptId);
}

export async function syncSaveSourceFragment(fragment: SourceFragment) {
  await syncWithOCC('sourceFragments', fragment, (id, updates) => {
    useKnowledgeStore.setState(state => ({
      sourceFragments: state.sourceFragments.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  });
}

export async function syncDeleteSourceFragment(fragmentId: string) {
  await syncDeleteWithDoc('sourceFragments', fragmentId);
}

export async function syncSaveRelation(relation: Relation) {
  await syncWithOCC('relations', relation, (id, updates) => {
    useKnowledgeStore.setState(state => ({
      relations: state.relations.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  });
}

export async function syncDeleteRelation(relationId: string) {
  await syncDeleteWithDoc('relations', relationId);
}

export async function syncSaveLearningPath(path: LearningPath) {
  await syncWithOCC('learningPaths', path, (id, updates) => {
    useCurriculumStore.setState(state => ({
      paths: state.paths.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  });
}

export async function syncDeleteLearningPath(pathId: string) {
  await syncDeleteWithDoc('learningPaths', pathId);
}

export async function syncSavePhase(phase: Phase) {
  await syncWithOCC('phases', phase, (id, updates) => {
    useCurriculumStore.setState(state => ({
      phases: state.phases.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  });
}

export async function syncDeletePhase(phaseId: string) {
  await syncDeleteWithDoc('phases', phaseId);
}

export async function syncSaveCompetency(competency: Competency) {
  await syncWithOCC('competencies', competency, (id, updates) => {
    useCurriculumStore.setState(state => ({
      competencies: state.competencies.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  });
}

export async function syncDeleteCompetency(competencyId: string) {
  await syncDeleteWithDoc('competencies', competencyId);
}

export async function syncSaveDeck(deck: Deck) {
  await syncWithOCC('decks', deck, (id, updates) => {
    useReviewStore.setState(state => ({
      decks: state.decks.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  });
}

export async function syncDeleteDeck(deckId: string) {
  await syncDeleteWithDoc('decks', deckId);
}

export async function syncSaveFlashcard(flashcard: Flashcard) {
  await syncWithOCC('flashcards', flashcard, (id, updates) => {
    useReviewStore.setState(state => ({
      flashcards: state.flashcards.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  });
}

export async function syncDeleteFlashcard(flashcardId: string) {
  await syncDeleteWithDoc('flashcards', flashcardId);
}

export async function syncSaveReadingLog(log: ReadingLog) {
  await syncWithOCC('readingLogs', log, (id, updates) => {
    useLibraryStore.setState(state => ({
      readingLogs: (state.readingLogs || []).map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  });
}

export async function syncDeleteReadingLog(logId: string) {
  await syncDeleteWithDoc('readingLogs', logId);
}

export async function syncAllLocalToCloud(): Promise<{ total: number; successCount: number }> {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error("Firebase belum dikonfigurasi di environment aplikasi.");
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Pengguna belum masuk (login) ke akun cloud.");
  }

  const notes = useNotesStore.getState().notes;
  const drafts = useWritingStore.getState().drafts;
  const projects = useProjectsStore.getState().projects;
  const books = useLibraryStore.getState().books;
  const readingLogs = useLibraryStore.getState().readingLogs || [];
  const concepts = useKnowledgeStore.getState().concepts;
  const fragments = useKnowledgeStore.getState().sourceFragments;
  const relations = useKnowledgeStore.getState().relations;
  const paths = useCurriculumStore.getState().paths;
  const phases = useCurriculumStore.getState().phases;
  const competencies = useCurriculumStore.getState().competencies;
  const decks = useReviewStore.getState().decks;
  const flashcards = useReviewStore.getState().flashcards;

  const total = notes.length + drafts.length + projects.length + books.length +
    readingLogs.length + concepts.length + fragments.length + relations.length + paths.length +
    phases.length + competencies.length + decks.length + flashcards.length;

  let successCount = 0;

  for (const n of notes) { await syncSaveNote(n); successCount++; }
  for (const d of drafts) { await syncSaveDraft(d); successCount++; }
  for (const p of projects) { await syncSaveProject(p); successCount++; }
  for (const b of books) { await syncSaveBook(b); successCount++; }
  for (const rl of readingLogs) { await syncSaveReadingLog(rl); successCount++; }
  for (const c of concepts) { await syncSaveConcept(c); successCount++; }
  for (const f of fragments) { await syncSaveSourceFragment(f); successCount++; }
  for (const r of relations) { await syncSaveRelation(r); successCount++; }
  for (const lp of paths) { await syncSaveLearningPath(lp); successCount++; }
  for (const ph of phases) { await syncSavePhase(ph); successCount++; }
  for (const comp of competencies) { await syncSaveCompetency(comp); successCount++; }
  for (const dk of decks) { await syncSaveDeck(dk); successCount++; }
  for (const fc of flashcards) { await syncSaveFlashcard(fc); successCount++; }

  return { total, successCount };
}

