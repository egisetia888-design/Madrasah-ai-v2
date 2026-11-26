import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAiRelationBackfillPlan,
  computeNoteMigrationPlan,
  computeSemanticCoverage,
} from './dataMigrationLogic';

test('migrate plan does not skip a note just because it already references a book', () => {
  const plan = computeNoteMigrationPlan(
    [
      {
        id: 'note-1',
        sourceId: 'book-1',
        rawQuote: 'Ilmu adalah cahaya yang dimasukkan ke dalam hati.',
        referenceCitation: 'Ihya Ulumuddin, Jilid 1, Hal. 22',
      },
      {
        id: 'note-2',
        sourceId: null,
        rawQuote: 'Kutipan tanpa catatan halaman.',
        referenceCitation: '',
      },
    ],
    [],
    [
      // note-1 already has a references relation to book-1 (NOT a SourceFragment!)
      { sourceNodeId: 'note-1', targetNodeId: 'book-1', relationType: 'references' },
    ]
  );

  assert.equal(plan.migratedCount, 2);
  assert.equal(plan.creations[0].reliabilityScore, 0.7);
  assert.equal(plan.creations[0].location, 'Ihya Ulumuddin, Jilid 1, Hal. 22');
  assert.equal(plan.creations[1].reliabilityScore, 0.1);
  assert.equal(plan.creations[1].location, 'Lokasi rujukan belum dicatat');
});

test('migrate plan deduplicates notes whose exact SourceFragment is already linked', () => {
  const plan = computeNoteMigrationPlan(
    [
      {
        id: 'note-1',
        sourceId: 'book-1',
        rawQuote: 'Kutipan yang sudah dipindah',
        referenceCitation: 'Hal. 10',
      },
    ],
    [
      {
        id: 'frag-1',
        sourceId: 'book-1',
        quote: 'Kutipan yang sudah dipindah',
      },
    ],
    [{ sourceNodeId: 'note-1', targetNodeId: 'frag-1', relationType: 'references' }]
  );

  assert.equal(plan.migratedCount, 0);
  assert.deepEqual(plan.notesToClear, ['note-1']);
});

test('Ta\'dib backfill resets unconfirmed AI relations but preserves explicit user confirmations', () => {
  const summary = computeAiRelationBackfillPlan([
    // Legacy buggy AI relation (verifiedBySystem: true without verifiedAt)
    {
      id: 'rel-legacy-ai',
      createdBy: 'ai_agent',
      verifiedBySystem: true,
      confidenceScore: 0.95,
    },
    // Explicitly confirmed by user via ProvenanceBadge
    {
      id: 'rel-confirmed-ai',
      createdBy: 'ai_agent',
      verifiedBySystem: true,
      verifiedAt: 1700000000000,
      confidenceScore: 0.88,
    },
    // Pending AI relation with corrupted confidenceScore
    {
      id: 'rel-bad-score',
      createdBy: 'ai_agent',
      verifiedBySystem: false,
      confidenceScore: 1.4,
    },
    // User manual relation
    {
      id: 'rel-manual',
      createdBy: 'user',
      verifiedBySystem: true,
      confidenceScore: 1.0,
    },
  ]);

  assert.equal(summary.normalizedCount, 2);
  assert.equal(summary.totalAiRelations, 3);
  assert.equal(summary.userConfirmedAiCount, 1);
  assert.equal(summary.pendingAiReviewCount, 2);
  assert.equal(summary.manualCount, 1);

  assert.deepEqual(summary.updates[0], {
    id: 'rel-legacy-ai',
    patch: { verifiedBySystem: false },
  });
  assert.deepEqual(summary.updates[1], {
    id: 'rel-bad-score',
    patch: { confidenceScore: 1 },
  });
});

test('semantic coverage flags empty arrays and counts indexed notes & drafts accurately', () => {
  const cov = computeSemanticCoverage(
    [
      { id: 'n1', embedding: [0.1, 0.2] },
      { id: 'n2', embedding: [] },
      { id: 'n3', embedding: undefined },
    ],
    [
      { id: 'd1', embedding: [0.3, 0.4] },
      { id: 'd2' },
    ]
  );

  assert.equal(cov.totalNotes, 3);
  assert.equal(cov.indexedNotes, 1);
  assert.deepEqual(cov.unindexedNoteIds, ['n2', 'n3']);
  assert.equal(cov.totalDrafts, 2);
  assert.equal(cov.indexedDrafts, 1);
  assert.deepEqual(cov.unindexedDraftIds, ['d2']);
  assert.equal(cov.totalItems, 5);
  assert.equal(cov.indexedItems, 2);
});
