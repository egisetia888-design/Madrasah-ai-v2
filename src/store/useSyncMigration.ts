import { useEffect } from 'react';
import { useNotesStore } from './notesStore';
import { useKnowledgeStore } from './knowledgeStore';
import { useLibraryStore } from './libraryStore';
import { useProjectsStore } from './projectsStore';
import { useWritingStore } from './writingStore';
import { useReviewStore } from './reviewStore';
import { createSyncMetadata } from './syncUtils';

export function useSyncMigration() {
  useEffect(() => {
    // A simple lazy migration that runs on mount
    const migrateNotes = () => {
      const { notes, folders, tags } = useNotesStore.getState();
      let changed = false;
      
      const newNotes = notes.map(n => {
        if (!n.syncStatus) {
          changed = true;
          return { ...n, ...createSyncMetadata() };
        }
        return n;
      });
      
      // Do similar for folders, tags...
      // For simplicity we just trigger an update if anything changed
      if (changed) {
        useNotesStore.setState({ notes: newNotes as any });
      }
    };
    
    const migrateKnowledge = () => {
      const { concepts, sourceFragments, relations } = useKnowledgeStore.getState();
      let changed = false;
      const migrate = (arr: any[]) => arr.map(item => {
        if (!item.syncStatus) {
          changed = true;
          return { ...item, ...createSyncMetadata() };
        }
        return item;
      });
      
      const updatedConcepts = migrate(concepts);
      const updatedFrags = migrate(sourceFragments);
      const updatedRels = migrate(relations);
      
      if (changed) {
        useKnowledgeStore.setState({ 
          concepts: updatedConcepts as any, 
          sourceFragments: updatedFrags as any, 
          relations: updatedRels as any 
        });
      }
    };

    const migrateLibrary = () => {
      const { books } = useLibraryStore.getState();
      let changed = false;
      const updated = books.map(b => {
        if (!b.syncStatus) {
          changed = true;
          return { ...b, ...createSyncMetadata() };
        }
        return b;
      });
      if (changed) useLibraryStore.setState({ books: updated as any });
    };

    // Run migrations
    migrateNotes();
    migrateKnowledge();
    migrateLibrary();
    // Similar for other stores if needed...
    
  }, []);
}
