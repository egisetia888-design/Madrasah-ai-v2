import { useNotesStore } from '../store/notesStore';
import { useKnowledgeStore } from '../store/knowledgeStore';
import {
  computeAiRelationBackfillPlan,
  computeNoteMigrationPlan,
  type AiRelationAuditSummary,
} from './dataMigrationLogic';

export const migrateNotesToFragments = (): number => {
  const { notes, updateNote } = useNotesStore.getState();
  const { addSourceFragment, addRelation, sourceFragments, relations } =
    useKnowledgeStore.getState();

  const plan = computeNoteMigrationPlan(notes, sourceFragments, relations);

  for (const creation of plan.creations) {
    const fragmentId = addSourceFragment({
      sourceId: creation.sourceId,
      quote: creation.quote,
      location: creation.location,
      reliabilityScore: creation.reliabilityScore,
    });

    addRelation({
      sourceNodeId: creation.noteId,
      targetNodeId: fragmentId,
      relationType: 'references',
      confidenceScore: 1.0,
      createdBy: 'user',
      explanation: 'Dimigrasikan dari kutipan mentah catatan lama',
      verifiedBySystem: true,
    });
  }

  for (const noteId of plan.notesToClear) {
    updateNote(noteId, {
      rawQuote: undefined,
      referenceCitation: undefined,
    });
  }

  return plan.migratedCount;
};

/**
 * Ta'dib Layer audit & backfill:
 * Inspects all AI-generated relations and normalizes unconfirmed legacy entries
 * without overwriting explicit user confirmations (`verifiedAt`).
 */
export const auditAiRelationsWithSummary = (): AiRelationAuditSummary => {
  const { relations, updateRelation } = useKnowledgeStore.getState();
  const summary = computeAiRelationBackfillPlan(relations);

  for (const item of summary.updates) {
    updateRelation(item.id, item.patch);
  }

  return summary;
};

export const backfillUnverifiedAiRelations = (): number => {
  return auditAiRelationsWithSummary().normalizedCount;
};
