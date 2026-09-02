# 📊 05. Model Data dan Integrasi API Backend

Seluruh struktur data di dalam **Madrasah — Personal Knowledge Operating System** diketik secara ketat menggunakan TypeScript di sisi klien dan diterjemahkan ke dalam interaksi rute API terstruktur untuk integrasi AI di sisi server.

---

## 5.1 Spesifikasi Model Data (TypeScript Schemas)

Semua entitas data dideklarasikan di `src/types/index.ts` untuk menjamin konsistensi di seluruh modul frontend. Setiap entitas mengadopsi metadata sinkronisasi (`SyncMetadata`) untuk mendukung ketahanan data lokal dan cloud:

```typescript
export type UUID = string;
export type SyncStatus = 'local_only' | 'pending_sync' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface SyncMetadata {
  revision: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  conflict?: ConflictData;
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
  status: BookStatus;
  progress: number;
  totalPages?: number;
  coverImage?: string;
  isEstimatedPages?: boolean;
  createdAt: number;
}
```

### 2. Entitas Zettelkasten & Konsep (Otak Kedua)
```typescript
export type NoteType = 'knowledge' | 'project' | 'writing' | 'personal' | 'research';
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
  createdAt: number;
}
```

*Catatan status per Agustus 2026: `confidenceScore` dan `verifiedBySystem` ada di skema sejak awal, tetapi `src/utils/autoLinker.ts` saat ini masih memberi nilai `confidenceScore: 0.95` dan `verifiedBySystem: true` secara hardcode untuk setiap relasi `createdBy: 'ai_agent'` — nilai ini tidak mencerminkan keyakinan aktual model. Perbaikan ini adalah FR1 di `docs/10_tadib_layer_prd.md`, disetujui tapi belum dieksekusi di kode.*

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
| `/api/ai/book-info` | `POST` | `{ title: string, author?: string }` | `{ totalPages: number, coverUrl: string, isEstimated: boolean, author?: string }` | Mengambil metadata buku (jumlah halaman & sampul) secara berjenjang dari Open Library API publik (pencarian judul + penulis, lalu fallback judul saja) sebagai sumber utama akurat, dan beralih ke estimasi AI (`isEstimated: true`) hanya jika data tidak ditemukan di Open Library. |

---

## 5.3 Keamanan, Kontrol Trafik, dan Optimasi

Untuk melindungi infrastruktur server serta menghemat biaya konsumsi API pihak ketiga, server Express.js di Madrasah dilengkapi tiga lapisan proteksi internal:

### 1. Gateway Penyedia AI Cerdas (HCNSEC & Multi-Provider Architecture)
Server backend secara dinamis membaca konfigurasi penyedia AI melalui fungsi `executeAIRequest`:
1. **Penyedia Utama (HCNSEC / OpenAI-Compatible Provider)**: Menggunakan `HCNSEC_API_KEY`, `HCNSEC_BASE_URL`, dan `HCNSEC_MODEL` melalui standar format endpoint OpenAI `/chat/completions`.
2. **Fallback Sekunder (OpenRouter & Gemini)**: Menggunakan `OPENROUTER_API_KEY` atau `@google/genai` SDK jika provider utama tidak ditentukan.

### 2. Pembatasan Frekuensi (Rate Limiting)
- **API Limiter Umum** (`/api/*`): Membatasi setiap alamat IP pengguna maksimal 100 panggilan dalam jendela waktu 15 menit.
- **AI Limiter Khusus** (`/api/ai/*`): Membatasi panggilan AI maksimal 30 permintaan per IP per menit untuk mencegah kelebihan beban pada kuota API.

### 3. In-Memory Caching Engine (TTL 1 Jam)
Server mendirikan mekanisme cache memori internal (`aiCache`) dengan masa aktif selama **1 jam**.
- Setiap kali ada permintaan AI masuk, server membuat kunci unik berdasarkan hash endpoint dan isi payload body.
- Jika permintaan dengan parameter yang sama masuk kembali sebelum batas waktu TTL berakhir, server akan mengembalikan hasil instan dari cache memori tanpa melakukan transaksi HTTP ulang ke penyedia AI luar.

### 4. Pembersihan JSON Kokoh (Robust JSON Parsing)
Respons dari model bahasa besar (LLM) sering kali terkontaminasi oleh blok kode Markdown (misalnya \`\`\`json ... \`\`\`) atau koma ekstra (*trailing commas*). Server Madrasah dilengkapi fungsi pembersihan ekspresi reguler khusus (`cleanAndParseJson`) untuk mengekstrak dan memvalidasi objek JSON murni sebelum dikirimkan ke aplikasi klien.
