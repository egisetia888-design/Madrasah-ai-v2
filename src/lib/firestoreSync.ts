import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where, runTransaction } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Note, Draft, Project, Book, SyncMetadata, Concept, SourceFragment, Relation, LearningPath, Phase, Competency, Deck, Flashcard } from '../types';
import { useNotesStore } from '../store/notesStore';
import { useWritingStore } from '../store/writingStore';
import { useProjectsStore } from '../store/projectsStore';
import { useLibraryStore } from '../store/libraryStore';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { useCurriculumStore } from '../store/curriculumStore';
import { useReviewStore } from '../store/reviewStore';

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

  auth.onAuthStateChanged((user) => {
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
    if (!user) return;

    const createUnsubscriber = <T extends { id: string } & SyncMetadata>(
      collectionName: string,
      storeSetter: (merged: T[]) => void,
      storeGetter: () => T[]
    ) => {
      const q = query(collection(db, collectionName), where('userId', '==', user.uid));
      return onSnapshot(
        q,
        (snapshot) => {
          const cloudItems: T[] = [];
          snapshot.forEach((docSnap) => cloudItems.push(docSnap.data() as T));
          if (cloudItems.length > 0) {
            storeSetter(mergeCloudData(storeGetter(), cloudItems));
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, collectionName)
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
  });
}

// Transaction helper for OCC
async function syncWithOCC<T extends { id: string } & SyncMetadata>(
  collectionName: string,
  item: T,
  setStateCallback: (id: string, updates: Partial<T>) => void
) {
  const user = auth.currentUser;
  if (!user) return;
  const path = `${collectionName}/${item.id}`;

  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, collectionName, item.id);
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
  } catch (err) {
    if (err instanceof Error && err.message === 'Conflict detected') return;
    setStateCallback(item.id, { syncStatus: 'failed' } as Partial<T>);
    handleFirestoreError(err, OperationType.WRITE, path);
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
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'notes', noteId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `notes/${noteId}`);
  }
}

export async function syncSaveDraft(draft: Draft) {
  await syncWithOCC('drafts', draft, (id, updates) => {
    useWritingStore.setState(state => ({
      drafts: state.drafts.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  });
}

export async function syncDeleteDraft(draftId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'drafts', draftId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `drafts/${draftId}`);
  }
}

export async function syncSaveProject(project: Project) {
  await syncWithOCC('projects', project, (id, updates) => {
    useProjectsStore.setState(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  });
}

export async function syncDeleteProject(projectId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
  }
}

export async function syncSaveBook(book: Book) {
  await syncWithOCC('books', book, (id, updates) => {
    useLibraryStore.setState(state => ({
      books: state.books.map(b => b.id === id ? { ...b, ...updates } : b)
    }));
  });
}

export async function syncDeleteBook(bookId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'books', bookId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `books/${bookId}`);
  }
}

export async function syncSaveConcept(concept: Concept) {
  await syncWithOCC('concepts', concept, (id, updates) => {
    useKnowledgeStore.setState(state => ({
      concepts: state.concepts.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  });
}

export async function syncDeleteConcept(conceptId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'concepts', conceptId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `concepts/${conceptId}`);
  }
}

export async function syncSaveSourceFragment(fragment: SourceFragment) {
  await syncWithOCC('sourceFragments', fragment, (id, updates) => {
    useKnowledgeStore.setState(state => ({
      sourceFragments: state.sourceFragments.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  });
}

export async function syncDeleteSourceFragment(fragmentId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'sourceFragments', fragmentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sourceFragments/${fragmentId}`);
  }
}

export async function syncSaveRelation(relation: Relation) {
  await syncWithOCC('relations', relation, (id, updates) => {
    useKnowledgeStore.setState(state => ({
      relations: state.relations.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  });
}

export async function syncDeleteRelation(relationId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'relations', relationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `relations/${relationId}`);
  }
}

export async function syncSaveLearningPath(path: LearningPath) {
  await syncWithOCC('learningPaths', path, (id, updates) => {
    useCurriculumStore.setState(state => ({
      paths: state.paths.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  });
}

export async function syncDeleteLearningPath(pathId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'learningPaths', pathId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `learningPaths/${pathId}`);
  }
}

export async function syncSavePhase(phase: Phase) {
  await syncWithOCC('phases', phase, (id, updates) => {
    useCurriculumStore.setState(state => ({
      phases: state.phases.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  });
}

export async function syncDeletePhase(phaseId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'phases', phaseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `phases/${phaseId}`);
  }
}

export async function syncSaveCompetency(competency: Competency) {
  await syncWithOCC('competencies', competency, (id, updates) => {
    useCurriculumStore.setState(state => ({
      competencies: state.competencies.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  });
}

export async function syncDeleteCompetency(competencyId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'competencies', competencyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `competencies/${competencyId}`);
  }
}

export async function syncSaveDeck(deck: Deck) {
  await syncWithOCC('decks', deck, (id, updates) => {
    useReviewStore.setState(state => ({
      decks: state.decks.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  });
}

export async function syncDeleteDeck(deckId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'decks', deckId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `decks/${deckId}`);
  }
}

export async function syncSaveFlashcard(flashcard: Flashcard) {
  await syncWithOCC('flashcards', flashcard, (id, updates) => {
    useReviewStore.setState(state => ({
      flashcards: state.flashcards.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  });
}

export async function syncDeleteFlashcard(flashcardId: string) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'flashcards', flashcardId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `flashcards/${flashcardId}`);
  }
}
