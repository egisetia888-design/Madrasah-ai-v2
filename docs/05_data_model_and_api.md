# 📊 05. Model Data dan Integrasi API Backend

Seluruh struktur data di dalam **Madrasah — Personal Knowledge Operating System** diketik secara ketat menggunakan TypeScript di sisi klien dan diterjemahkan ke dalam interaksi rute API terstruktur untuk integrasi AI di sisi server.

---

## 5.1 Spesifikasi Model Data (TypeScript Schemas)

Semua entitas data dideklarasikan di `src/types/index.ts` untuk menjamin konsistensi di seluruh modul frontend. Setiap entitas mengadopsi metadata revisi lokal (`SyncMetadata`) untuk pelacakan pembaruan di IndexedDB:

```typescript
export type UUID = string;
export type SyncStatus = 'local_only' | 'saved';

export interface SyncMetadata {
  revision: number;
  updatedAt: number;
  syncStatus: SyncStatus;
}
```

### 1. Entitas Literatur (Pustaka)
```typescript
export interface Author extends SyncMetadata {
  id: UUID;
  name: string;
  createdAt: number;
}

export type BookStatus = 'wishlist' | 'owned' | 'reading' | 'finished' | 'summarized' | 'connected' | 'applied' | 'published';

export interface Book extends SyncMetadata {
  id: UUID;
  title: string;
  authorId: UUID | null;
  categoryId: UUID | null;
  isbn?: string;
  status: BookStatus;
  progress: number;
  totalPages?: number;
  coverImage?: string;
  isEstimatedPages?: boolean;
  createdAt: number;
}

export type EditionLanguagePreference = 'all' | 'id' | 'original';

export interface BookCandidate {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  totalPages: number;
  coverUrl: string;
  publisher?: string;
  publishedYear?: string;
  language?: string;
  source: 'Open Library' | 'Digital Archive' | 'Google Books';
  isEstimated: boolean;
  matchScore?: number;
}

export interface ReadingLog extends SyncMetadata {
  id: UUID;
  bookId: UUID;
  date: number; // timestamp
  pagesRead: number;
  startPage: number;
  endPage: number;
  createdAt: number;
}
```

### 2. Entitas Zettelkasten & Konsep (Otak Kedua)
```typescript
export type NoteType = 'fleeting' | 'literature' | 'permanent' | 'knowledge' | 'project' | 'writing' | 'personal' | 'research';
export type NoteStatus = 'unprocessed' | 'processed';

export interface Note extends SyncMetadata {
  id: UUID;
  title: string;
  content: string;
  rawQuote?: string;
  referenceCitation?: string;
  type: NoteType;
  status: NoteStatus;
  sourceId?: UUID | null;
  folderId: UUID | null;
  tags: UUID[];
  icon?: string;
  createdAt: number;
}

export type ConceptEvolutionStatus = 'emerging' | 'defined' | 'mastered';

export interface Concept extends SyncMetadata {
  id: UUID;
  name: string;
  definition: string;
  aliases: string[];
  evolutionStatus: ConceptEvolutionStatus;
  createdAt: number;
}

export interface SourceFragment extends SyncMetadata {
  id: UUID;
  sourceId: UUID | null;
  quote: string;
  location: string;
  context?: string;
  reliabilityScore: number;
  createdAt: number;
}
```

### 3. Entitas Kurikulum & Studi Mandiri
```typescript
export interface LearningPath extends SyncMetadata {
  id: UUID;
  title: string;
  description: string;
  createdAt: number;
}

export interface Phase extends SyncMetadata {
  id: UUID;
  pathId: UUID;
  title: string;
  order: number;
}

export type CompetencyStatus = 'not-started' | 'in-progress' | 'done';

export interface Competency extends SyncMetadata {
  id: UUID;
  phaseId: UUID;
  title: string;
  status: CompetencyStatus;
  order: number;
  bookIds: UUID[];
  outputIds: UUID[];
}
```

### 4. Entitas Proyek & Studio Menulis
```typescript
export type ProjectStatus = 'planned' | 'active' | 'review' | 'completed' | 'archived';

export interface Project extends SyncMetadata {
  id: UUID;
  title: string;
  description: string;
  status: ProjectStatus;
  dueDate?: number;
  createdAt: number;
}

export type WritingStatus = 'idea' | 'outline' | 'draft' | 'editing' | 'review' | 'published';

export interface Draft extends SyncMetadata {
  id: UUID;
  title: string;
  content: string;
  status: WritingStatus;
  icon?: string;
  tags?: string[];
  createdAt: number;
}
```

### 5. Entitas Graf Pengetahuan (Nodes & Relations)
Entitas ini adalah tulang punggung Graf Pengetahuan dan lapisan Ta'dib (lihat `docs/10_tadib_layer_prd.md`). Sebelumnya tidak terdokumentasi di sini meski sudah ada di `src/types/index.ts` — celah ini diperbaiki agar dokumentasi konsisten dengan kode sumber.

```typescript
export type NodeType = 'note' | 'book' | 'author' | 'concept' | 'writing' | 'project' | 'source_fragment';

export interface Node {
  id: UUID;
  label: string;
  type: NodeType;
}

export interface Edge {
  id: UUID;
  source: UUID;
  target: UUID;
  label?: string;
}

export type RelationType = 'supports' | 'contradicts' | 'expands_on' | 'defines' | 'is_a' | 'part_of' | 'references' | 'applies';
export type RelationCreator = 'user' | 'ai_agent';

export interface Relation extends SyncMetadata {
  id: UUID;
  sourceNodeId: UUID;
  targetNodeId: UUID;
  relationType: RelationType;
  confidenceScore: number;
  createdBy: RelationCreator;
  explanation?: string;
  verifiedBySystem: boolean;
  verifiedAt?: number;
  createdAt: number;
}
```

*Catatan status: Relasi buatan `ai_agent` di `src/utils/autoLinker.ts` dan `src/hooks/useKnowledgeGraph.ts` selalu menggunakan `confidenceScore` aktual dan `verifiedBySystem: false` sampai pengguna mengetuk konfirmasi di `ProvenanceBadge` (yang mencatat `verifiedAt`). Audit Ta'dib di Pengaturan hanya menormalkan relasi AI tanpa `verifiedAt`.*

### 6. Entitas Spaced Repetition (Review)
```typescript
export interface Deck extends SyncMetadata {
  id: UUID;
  name: string;
  description: string;
  noteId?: UUID | null;
  conceptId?: UUID | null;
  createdAt: number;
}

export interface Flashcard extends SyncMetadata {
  id: UUID;
  front: string;
  back: string;
  deckId: UUID | null;
  noteId?: UUID | null;
  conceptId?: UUID | null;
  interval: number;
  repetition: number;
  efactor: number;
  dueDate: number;
  createdAt: number;
}
```

---

## 5.2 Antarmuka API Backend (Express Router)

Server backend (`server.ts`) mengekspos 7 endpoint fungsional khusus untuk memproses tugas-tugas kognitif bertenaga AI secara aman:

| Endpoint | Metode | Parameter Payload (JSON) | Deskripsi Respons (JSON) | Peran AI & Model |
| :--- | :--- | :--- | :--- | :--- |
| `/api/ai/zettelkasten` | `POST` | `{ prompt: string, notes: Note[], concepts: Concept[], fragments: SourceFragment[], relations: Relation[] }` | `{ result: string }` | Menganalisis jaringan pengetahuan pengguna, melacak asal-usul (*provenance*), dan merumuskan sintesis baru dalam sintaks Markdown. |
| `/api/ai/suggest-tags` | `POST` | `{ content: string, notes: Note[], concepts: Concept[] }` | `{ tags: string[], icon: string, connections: string[] }` | Menganalisis catatan baru untuk memberikan rekomendasi tag fungsional, ikon representatif dari Lucide-react, dan tautan catatan relevan. |
| `/api/ai/generate-flashcards` | `POST` | `{ content: string }` | `{ flashcards: [{ front: string, back: string }] }` | Membaca catatan secara komprehensif untuk mengekstrak 5-10 kartu tanya-jawab esensial guna latihan memori terdistribusi. |
| `/api/ai/grade-flashcard` | `POST` | `{ question: string, correctAnswer: string, userAnswer: string }` | `{ isCorrect: boolean, quality: number, feedback: string }` | Menilai keselarasan konseptual jawaban pengguna dibandingkan kunci jawaban asli berdasarkan skala kualitas SuperMemo-2 (skala 0-5). |
| `/api/ai/generate-syllabus` | `POST` | `{ topic: string }` | `{ title: string, description: string, phases: [{ title, description, order, competencies: [...] }] }` | Merancang kurikulum modular baru lengkap dengan Fase Belajar dan Kompetensi dari topik masukan pengguna. |
| `/api/ai/summarize-literature` | `POST` | `{ content: string }` | `{ mainProblem: string, methodology: string, conclusion: string }` | Memindai dokumen akademik panjang untuk menyaring tiga intisari utama: Masalah Utama, Metodologi, dan Kesimpulan Akhir. |
| `/api/ai/book-info` | `POST` | `{ title?: string, author?: string, isbn?: string, languagePref?: 'all' \| 'id' \| 'original', forceRefresh?: boolean }` | `{ candidates: BookCandidate[], totalPages: number, coverUrl: string, isEstimated: boolean, title?: string, author?: string, isbn?: string }` | Resolusi metadata faktual tingkat edisi secara paralel dari **Open Library** (`/isbn/{isbn}.json`, `/works/{id}/editions.json`, dan pengayaan `ocaid`) serta **Digital Archive Entries** (`archive.org/advancedsearch.php` `mediatype:texts`) dengan verifikasi `HEAD` URL sampul serta filter ketat anti-tiruan, anti-artikel jurnal, dan validasi penulis (berjalan paralel dengan Google Books dari browser klien, 0 token AI). |

---

## 5.3 Keamanan, Kontrol Trafik, dan Optimasi

Untuk melindungi infrastruktur server serta menghemat biaya konsumsi API pihak ketiga, server Express.js di Madrasah dilengkapi tiga lapisan proteksi internal:

### 1. Mesin AI Tunggal Google Gemini (Hybrid Hemat Token)
Server backend berkomunikasi langsung dengan **Google Gemini API** melalui SDK resmi `@google/genai` (`User-Agent: 'aistudio-build'`) menggunakan pemetaan model hybrid berbasis beban dan efisiensi kuota:
1. **Jalur Ringan & Kuantitas Tinggi — `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`)**:
   - Tanpa konsumsi *thinking tokens*, latensi terendah, dan kapasitas kuota harian maksimal.
   - Digunakan oleh: `/api/ai/suggest-tags`, `/api/ai/grade-flashcard`, `/api/ai/summarize-literature`, dan cadangan otomatis saat model sintesis sibuk.
2. **Jalur Sintesis & Struktur Kompleks — `gemini-4-hydrogen` (`ThinkingLevel.LOW`)**:
   - Penalaran terukur dengan anggaran *thinking* minimum agar kualitas sintesis dan skema JSON tetap tajam namun tetap irit token.
   - Digunakan oleh: `/api/ai/zettelkasten`, `/api/ai/generate-flashcards`, dan `/api/ai/generate-syllabus`.
3. **Ketahanan & Pengaman Kesalahan**:
   - *Exponential backoff* otomatis untuk lonjakan sementara `503`/`UNAVAILABLE`, `abortSignal` batas waktu per model (~20s saat tersedia model cadangan) untuk failover lintas model cepat ke `gemini-3.1-flash-lite` pada `429`/`404`/timeout, serta pesan diagnostik jelas menuju **Settings > Secrets** bila `GEMINI_API_KEY` belum terpasang atau tidak valid.

### 2. Kompresi Konteks & Formula per Fitur AI
Setiap endpoint menerapkan pemangkasan input di klien (`prepareSuggestTagsPayload`, `prepareZettelkastenPayload`, `prepareContentExcerpt`) dan server (`compactText`, `headTailExcerpt`, `selectRelevantZettelkastenContext`) dengan format JSON ketat:
- **/api/ai/zettelkasten**: `gemini-4-hydrogen` (`ThinkingLevel.LOW`), seleksi 6 catatan, 6 konsep, 5 fragmen, dan 8 relasi paling relevan terhadap kata kunci prompt (Timeout 45s).
- **/api/ai/suggest-tags**: `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`), konten *head+tail* ≤2.200 karakter + maks 15 judul catatan & 12 konsep (Timeout 45s).
- **/api/ai/generate-flashcards**: `gemini-4-hydrogen` (`ThinkingLevel.LOW`), konten *head+tail* ≤4.500 karakter, menghasilkan 5–7 kartu atomik MIP (Timeout 48s).
- **/api/ai/grade-flashcard**: `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`), evaluasi semantik skala SM-2 (0–5) dengan feedback 1–2 kalimat (Timeout 45s).
- **/api/ai/generate-syllabus**: `gemini-4-hydrogen` (`ThinkingLevel.LOW`) dengan failover otomatis ke `gemini-3.1-flash-lite`, topik ≤300 karakter, menghasilkan 3 fase × 3–4 kompetensi ringkas (Timeout 45s).
- **/api/ai/summarize-literature**: `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`), konten *head+tail* ≤4.500 karakter, menghasilkan 3 pilar telaah (Timeout 45s).
- **/api/ai/book-info**: Pencarian paralel Google Books langsung di browser klien (`src/lib/bookCatalog.ts`) + resolusi edisi spesifik Open Library & Digital Archive Entries (`archive.org`) di server dengan pengayaan `ocaid`, penyaringan anti-tiruan/anti-artikel, preferensi bahasa edisi, dan verifikasi `HEAD` URL sampul (0 token AI).

### 3. Pembatasan Frekuensi (Rate Limiting)
- **API Limiter Umum** (`/api/*`): Membatasi setiap alamat IP pengguna maksimal 100 panggilan dalam jendela waktu 15 menit.
- **AI Limiter Khusus** (`/api/ai/*`): Membatasi panggilan AI maksimal 30 permintaan per IP per menit untuk mencegah kelebihan beban pada kuota API.

### 4. Bounded LRU Caching Engine (TTL 2 Jam, Maks 500 Entri)
Server menggunakan cache LRU terbatas (`BoundedAICache`) dengan masa aktif **2 jam** dan kapasitas maksimal **500 entri**.
- Setiap permintaan AI menghasilkan kunci hash SHA-256 dari endpoint dan payload yang telah dinormalisasi (termasuk hash konteks terkompresi pada Zettelkasten).
- Permintaan identik yang masuk kembali sebelum TTL berakhir langsung dilayani dari memori tanpa memanggil Google Gemini API.

### 5. Pembersihan JSON Kokoh (Robust JSON Parsing)
Respons model divalidasi dengan `responseSchema` dan dibersihkan otomatis melalui `cleanAndParseJson` (serta `repairTruncatedJson`) untuk menjamin struktur JSON valid sebelum dikirim ke klien.
