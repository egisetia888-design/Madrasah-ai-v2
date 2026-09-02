import { useNotesStore } from '../store/notesStore';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { Relation } from '../types';

export const migrateNotesToFragments = () => {
  const { notes, updateNote } = useNotesStore.getState();
  const { addSourceFragment, addRelation, sourceFragments, relations } = useKnowledgeStore.getState();

  let migratedCount = 0;

  notes.forEach((note) => {
    // If the note has a rawQuote and hasn't been completely migrated
    if (note.rawQuote && note.rawQuote.trim() !== '') {
      
      // Check if we already migrated this by checking existing relations
      const alreadyMigrated = relations.some(
        (r) => r.sourceNodeId === note.id && r.relationType === 'references'
      );

      if (!alreadyMigrated) {
        // Create a SourceFragment
        const fragmentId = addSourceFragment({
          sourceId: note.sourceId || null,
          quote: note.rawQuote,
          location: note.referenceCitation || 'Unknown location',
          reliabilityScore: 1.0, // Default for user-created notes
        });

        // Create Relation: Note -> references -> SourceFragment
        addRelation({
          sourceNodeId: note.id,
          targetNodeId: fragmentId,
          relationType: 'references',
          confidenceScore: 1.0,
          createdBy: 'user',
          explanation: 'Migrated from legacy raw quote',
          verifiedBySystem: true,
        });

        migratedCount++;
        
        // Mark as deprecated in Note (Optionally we can clear them out, but for zero-data-loss we keep them for a while or clear them to avoid duplicate data)
        // For safe migration, we just leave rawQuote intact but it will be ignored by the UI later, or we can clear it.
        // We'll clear it to prevent re-migration issues and clean up the old schema.
        updateNote(note.id, {
          rawQuote: undefined,
          referenceCitation: undefined
        });
      }
    }
  });

  return migratedCount;
};
