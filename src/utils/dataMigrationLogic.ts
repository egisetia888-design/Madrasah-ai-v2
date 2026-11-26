import type { Draft, Note, Relation, SourceFragment } from '../types';

export interface FragmentCreationInput {
  noteId: string;
  sourceId: string | null;
  quote: string;
  location: string;
  reliabilityScore: number;
}

export interface NoteMigrationPlan {
  migratedCount: number;
  creations: FragmentCreationInput[];
  notesToClear: string[];
}

export interface RelationAuditUpdate {
  id: string;
  patch: Partial<Pick<Relation, 'verifiedBySystem' | 'confidenceScore'>>;
}

export interface AiRelationAuditSummary {
  normalizedCount: number;
  totalAiRelations: number;
  userConfirmedAiCount: number;
  pendingAiReviewCount: number;
  manualCount: number;
  updates: RelationAuditUpdate[];
}

export interface SemanticCoverageSummary {
  totalNotes: number;
  indexedNotes: number;
  totalDrafts: number;
  indexedDrafts: number;
  totalItems: number;
  indexedItems: number;
  unindexedNoteIds: string[];
  unindexedDraftIds: string[];
  allNoteIds: string[];
  allDraftIds: string[];
}

export function hasValidEmbedding(embedding?: number[] | null): boolean {
  return Array.isArray(embedding) && embedding.length > 0;
}

export function computeSemanticCoverage(
  notes: Pick<Note, 'id' | 'embedding'>[],
  drafts: Pick<Draft, 'id' | 'embedding'>[]
): SemanticCoverageSummary {
  const unindexedNoteIds: string[] = [];
  const allNoteIds: string[] = [];
  let indexedNotes = 0;

  for (const n of notes) {
    allNoteIds.push(n.id);
    if (hasValidEmbedding(n.embedding)) {
      indexedNotes++;
    } else {
      unindexedNoteIds.push(n.id);
    }
  }

  const unindexedDraftIds: string[] = [];
  const allDraftIds: string[] = [];
  let indexedDrafts = 0;

  for (const d of drafts) {
    allDraftIds.push(d.id);
    if (hasValidEmbedding(d.embedding)) {
      indexedDrafts++;
    } else {
      unindexedDraftIds.push(d.id);
    }
  }

  return {
    totalNotes: notes.length,
    indexedNotes,
    totalDrafts: drafts.length,
    indexedDrafts,
    totalItems: notes.length + drafts.length,
    indexedItems: indexedNotes + indexedDrafts,
    unindexedNoteIds,
    unindexedDraftIds,
    allNoteIds,
    allDraftIds,
  };
}

/**
 * Pure planner for migrating legacy Note.rawQuote / Note.referenceCitation to standalone SourceFragment entities.
 * - Avoids skipping notes merely because they already reference a Book or another Note.
 * - Assigns truthful Ta'dib reliability defaults: 0.7 (Sekunder) with citation, 0.1 (Belum Diverifikasi) without citation.
 */
export function computeNoteMigrationPlan(
  notes: Pick<Note, 'id' | 'sourceId' | 'rawQuote' | 'referenceCitation'>[],
  sourceFragments: Pick<SourceFragment, 'id' | 'sourceId' | 'quote'>[],
  relations: Pick<Relation, 'sourceNodeId' | 'targetNodeId' | 'relationType'>[]
): NoteMigrationPlan {
  const fragmentMap = new Map(sourceFragments.map((f) => [f.id, f]));
  const creations: FragmentCreationInput[] = [];
  const notesToClear: string[] = [];

  for (const note of notes) {
    const trimmedQuote = note.rawQuote?.trim() ?? '';
    if (!trimmedQuote) continue;

    // Check only relations pointing to an actual SourceFragment with the same quote
    const alreadyMigratedToFragment = relations.some((r) => {
      if (r.sourceNodeId !== note.id || r.relationType !== 'references') return false;
      const frag = fragmentMap.get(r.targetNodeId);
      if (!frag) return false;
      return frag.quote.trim() === trimmedQuote;
    });

    if (alreadyMigratedToFragment) {
      notesToClear.push(note.id);
      continue;
    }

    const trimmedCitation = note.referenceCitation?.trim() ?? '';
    creations.push({
      noteId: note.id,
      sourceId: note.sourceId || null,
      quote: trimmedQuote,
      location: trimmedCitation || 'Lokasi rujukan belum dicatat',
      reliabilityScore: trimmedCitation ? 0.7 : 0.1,
    });
    notesToClear.push(note.id);
  }

  return {
    migratedCount: creations.length,
    creations,
    notesToClear,
  };
}

/**
 * Pure Ta'dib Layer audit & backfill planner:
 * - Normalizes AI-created relations marked `verifiedBySystem: true` WITHOUT explicit user confirmation (`verifiedAt`).
 * - Preserves AI relations explicitly confirmed by the user (`verifiedAt` present).
 * - Clamps or repairs invalid `confidenceScore` values so provenance UI never shows NaN or >100%.
 */
export function computeAiRelationBackfillPlan(
  relations: Pick<Relation, 'id' | 'createdBy' | 'verifiedBySystem' | 'verifiedAt' | 'confidenceScore'>[]
): AiRelationAuditSummary {
  const updates: RelationAuditUpdate[] = [];
  let totalAiRelations = 0;
  let userConfirmedAiCount = 0;
  let pendingAiReviewCount = 0;
  let manualCount = 0;

  for (const rel of relations) {
    if (rel.createdBy !== 'ai_agent') {
      manualCount++;
      continue;
    }

    totalAiRelations++;
    const patch: Partial<Pick<Relation, 'verifiedBySystem' | 'confidenceScore'>> = {};
    let needsUpdate = false;

    const isExplicitlyConfirmed = Boolean(rel.verifiedAt && rel.verifiedBySystem);
    if (rel.verifiedBySystem && !rel.verifiedAt) {
      patch.verifiedBySystem = false;
      needsUpdate = true;
    } else if (typeof rel.verifiedBySystem !== 'boolean') {
      patch.verifiedBySystem = false;
      needsUpdate = true;
    }

    if (
      typeof rel.confidenceScore !== 'number' ||
      !Number.isFinite(rel.confidenceScore) ||
      rel.confidenceScore < 0 ||
      rel.confidenceScore > 1
    ) {
      const repaired =
        typeof rel.confidenceScore === 'number' && Number.isFinite(rel.confidenceScore)
          ? Math.min(1, Math.max(0, rel.confidenceScore))
          : 0.5;
      patch.confidenceScore = repaired;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.push({ id: rel.id, patch });
    }

    if (isExplicitlyConfirmed) {
      userConfirmedAiCount++;
    } else {
      pendingAiReviewCount++;
    }
  }

  return {
    normalizedCount: updates.length,
    totalAiRelations,
    userConfirmedAiCount,
    pendingAiReviewCount,
    manualCount,
    updates,
  };
}
