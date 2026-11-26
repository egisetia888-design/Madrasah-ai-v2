import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_AUTHOR_SCORE,
  MIN_TITLE_SCORE,
  buildArchiveSearchQuery,
  computeAuthorMatchScore,
  computeTitleMatchScore,
  deduplicateAndRankCandidates,
  findDuplicateBook,
  isRejectedArchiveEntry,
  normalizeLanguageCode,
  resolveInitialBookProgress,
} from "./bookMetadata";
import type { Author, Book, BookCandidate } from "../types";

test("rejects derivative titles and same-surname author mismatches", () => {
  assert.equal(computeTitleMatchScore("Atomic Habits", "Summary of Atomic Habits"), 0);
  assert.equal(computeTitleMatchScore("Atomic Habits", "Atomic Habits Daily Calendar 2025"), 0);
  assert.ok(
    computeTitleMatchScore(
      "Atomic Habits",
      "Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones"
    ) >= MIN_TITLE_SCORE
  );

  assert.equal(computeAuthorMatchScore("James Clear", ["John Clear"]) < MIN_AUTHOR_SCORE, true);
  assert.equal(computeAuthorMatchScore("James Clear", ["James Clear"]), 1);
  assert.ok(
    computeAuthorMatchScore("Pramoedya Ananta Toer", ["Toer, Pramoedya Ananta"]) >= MIN_AUTHOR_SCORE
  );
});

test("filters Digital Archive journal articles and pirated mirror filenames", () => {
  assert.equal(
    isRejectedArchiveEntry(
      "32-ijels-111202042-diexsisin",
      "Diexsis in Novel Bumi Manusia and Bukan Pasar Malam by Pramoedya Ananta Toer",
      "Bumi Manusia"
    ),
    true
  );
  assert.equal(
    isRejectedArchiveEntry(
      "bumimanusiabytoerpramoedyaanantazlib.org",
      "Bumi Manusia By Toer Pramoedya Ananta (z Lib.org)",
      "Bumi Manusia"
    ),
    true
  );
  assert.equal(
    isRejectedArchiveEntry("filosofiteras", "Filosofi Teras", "Filosofi Teras"),
    false
  );
});

test("builds safe Archive Lucene queries and normalizes language codes", () => {
  assert.equal(
    buildArchiveSearchQuery("Bumi Manusia: Edisi Baru", "Pramoedya (Toer)", ""),
    "title:(Bumi Manusia Edisi Baru) AND creator:(Pramoedya Toer) AND mediatype:(texts)"
  );
  assert.equal(
    buildArchiveSearchQuery("Atomic Habits", "James Clear", "978-0735211292"),
    'isbn:"9780735211292" AND mediatype:(texts)'
  );
  assert.equal(normalizeLanguageCode("/languages/ind"), "id");
  assert.equal(normalizeLanguageCode("Indonesian"), "id");
  assert.equal(normalizeLanguageCode("eng"), "en");
});

test("deduplicates by ISBN while enriching missing fields across sources", () => {
  const olSparse: BookCandidate = {
    id: "ol-1",
    title: "Atomic Habits",
    author: "James Clear",
    isbn: "9781847941831",
    totalPages: 0,
    coverUrl: "",
    language: "en",
    source: "Open Library",
    isEstimated: false,
    matchScore: 1.4,
  };
  const archiveFull: BookCandidate = {
    id: "ia-1",
    title: "Atomic habits",
    author: "James Clear",
    isbn: "9781847941831",
    totalPages: 326,
    coverUrl: "https://archive.org/services/img/atomichabitseasy0000clea",
    language: "en",
    source: "Digital Archive",
    isEstimated: false,
    matchScore: 1.35,
  };
  const ranked = deduplicateAndRankCandidates([olSparse, archiveFull], "all", 6);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].totalPages, 326);
  assert.equal(ranked[0].coverUrl, "https://archive.org/services/img/atomichabitseasy0000clea");
});

test("detects duplicate books by ISBN or title+author and clamps initial progress", () => {
  const authors: Author[] = [
    { id: "a1", name: "James Clear", createdAt: 1, revision: 1, updatedAt: 1, syncStatus: "local_only" },
  ];
  const books: Book[] = [
    {
      id: "b1",
      title: "Atomic Habits",
      authorId: "a1",
      categoryId: null,
      isbn: "9780735211292",
      status: "reading",
      progress: 50,
      totalPages: 320,
      createdAt: 1,
      revision: 1,
      updatedAt: 1,
      syncStatus: "local_only",
    },
  ];

  assert.equal(findDuplicateBook(books, authors, { title: "atomic habits" })?.id, "b1");
  assert.equal(findDuplicateBook(books, authors, { title: "Other", isbn: "978-0735211292" })?.id, "b1");
  assert.equal(
    findDuplicateBook(books, authors, { title: "Atomic Habits", authorName: "John Clear" }),
    null
  );

  assert.equal(resolveInitialBookProgress("finished", "10", 320), 320);
  assert.equal(resolveInitialBookProgress("reading", "42", 320), 42);
  assert.equal(resolveInitialBookProgress("reading", "999", 320), 320);
  assert.equal(resolveInitialBookProgress("owned", "42", 320), 0);
});
