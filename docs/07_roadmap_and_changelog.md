# 🗺️ 07. Peta Jalan Pengembangan (Roadmap) dan Changelog

Dokumen ini melacak visi masa depan pengembangan fungsionalitas Madrasah serta mencatat riwayat perubahan sistem yang telah diimplementasikan.

---

## 7.1 Peta Jalan Pengembangan (Roadmap)

Pengembangan **Madrasah — Personal Knowledge Operating System** dibagi ke dalam tiga fase strategis untuk bertransformasi dari sistem operasi pengetahuan personal lokal menjadi platform kolaboratif akademis yang kokoh.

### Fase 1: Fondasi Kokoh & PKOS Inti (Selesai / Tahap Aktual)
- [x] **Bahasa Visual Monokrom Terpadu**: Pembersihan total palet warna sekunder menuju nuansa monokrom hitam-putih murni untuk menjamin ketenangan kognitif pengguna.
- [x] **Zettelkasten & AI Copilot**: Manajemen catatan Markdown hierarkis lengkap dengan saran tag dan koneksi relasional berbasis AI.
- [x] **Visualisasi Graf Pengetahuan**: Jaringan kognitif interaktif bertenaga D3.js dengan dukungan penyorotan dan drawer detail responsif.
- [x] **Latihan Memori SM-2**: Implementasi algoritma SuperMemo-2 fungsional didukung oleh pembuat kartu ulasan otomatis (*AI Flashcard Generator*) dan penilaian konsep (*AI Grading Assistant*).
- [x] **AI Syllabus Planner**: Desain kurikulum otomatis dari topik studi mentah ke dalam fase belajar modular yang terintegrasi dengan pustaka rujukan.
- [x] **Studio Menulis Bebas Gangguan**: Lingkungan penulisan esai murni terhubung dengan bank referensi pribadi di Otak Kedua.

### Fase 1.5: Lapisan Ta'dib & Fondasi Berpikir-Reflektif (Sedang Berjalan)
Bukan pivot produk — perbaikan integritas di atas fondasi yang sudah shipped di Fase 1. Rincian lengkap: `docs/10_tadib_layer_prd.md` dan `docs/11_reading_reflection_connecting_prd.md`.

**A. Lapisan Ta'dib (Provenance & Kejujuran Epistemik AI)**
- [x] **Fase 0 — FR1**: Perbaiki default `verifiedBySystem: true` yang di-hardcode di `autoLinker.ts` untuk relasi `createdBy: 'ai_agent'`. Nilai sekarang default `false`, hanya `true` jika diverifikasi manusia atau relasi struktural pengguna. (Selesai dan terverifikasi di kode).
- [x] **Fase 1 — FR2+FR3**: Komponen `ProvenanceBadge` + aksi "Konfirmasi" satu-ketuk (tanpa dialog/formulir, sesuai prinsip Gesekan Minimal di §1.4). Terintegrasi di `NoteDetailPage.tsx`, `ConceptsPage.tsx`, serta pembedaan visual garis relasi unverified AI pada `KnowledgeGraphPage.tsx`. (Selesai dan terverifikasi di kode).
- [x] **Fase 2 — FR4+FR5**: Field `epistemicDomain` (`umum` / `akidah` / `fiqih` / `tasawuf` / `sejarah`) + disclaimer konsisten "Hasil AI — periksa ke sumber sebelum dijadikan pegangan." di setiap output AI Copilot (`CurriculumPage.tsx`, `ReviewSessionPage.tsx`, `ConceptsPage.tsx`, `NoteDetailPage.tsx`, `BookDetailPage.tsx`, `LibraryPage.tsx`, `AIAssistantDialog.tsx`). (Selesai dan terverifikasi di kode).
- [ ] **Fase 3 — Jalur Validasi Ulama**: Di luar cakupan PRD saat ini. Gerbang wajib sebelum Madrasah dibuka untuk pengguna selain Anda sendiri.

**B. Fondasi Baca–Berpikir–Refleksi–Menyambungkan**
- [x] **Panel catatan/konsep belum terhubung**: Kueri pasif atas relasi berjumlah 0–1; tampil di kartu "Belum Terhubung" pada `DashboardPage.tsx` (baris ~252-269), murni tampilan tanpa langkah interaksi tambahan. (Selesai dan terverifikasi di kode).
- [x] **Resurfacing mingguan**: Catatan `processed` yang tidak disentuh selama >14 hari dimunculkan sebagai kartu "Resurfacing Mingguan" pada `DashboardPage.tsx` (baris ~272-289) dengan rotasi bergilir mingguan. (Selesai dan terverifikasi di kode).
- [x] **Aksi konfirmasi (di atas)**: Memakai ulang komponen `ProvenanceBadge` sebagai satu-satunya titik gesekan sadar satu-sentuhan tanpa modal berlebih. (Selesai dan terverifikasi di kode).

### Fase 2: Sinkronisasi Awan & Autentikasi Multi-User (Fase Aktif)
- [x] **Multi-User Authentication**: Integrasi antarmuka dan penanganan Firebase Auth (Google Sign-In) dengan fallback anggun saat offline (`src/store/authStore.ts` & `src/modules/settings/SettingsPage.tsx`). (Selesai dan terverifikasi di kode).
- [x] **Durable Cloud Persistence & OCC Sync**: Implementasi protokol Optimistic Concurrency Control (`syncWithOCC`), pemutakhiran menyeluruh data lokal ke Firestore via `syncAllLocalToCloud`, serta kendali manual di halaman Pengaturan. (Selesai dan terverifikasi di kode).
- [ ] **Sinkronisasi Multidevice Real-Time Lanjutan**: Pembaruan data instan latar belakang antar-sesi aktif secara konstan.

### Fase 3: Kolaborasi, Ekspor Literer, dan Ekosistem Penerbitan (Jangka Panjang)
- [x] **Ekspor Format Kaya**: Ekspor draf tulisan dari Studio Menulis langsung ke format Markdown lengkap dengan Frontmatter YAML, unduh berkas `.md`, serta Cetak / Simpan PDF bersih menggunakan lembar gaya cetak `@media print` tanpa chrome UI. (Selesai dan terverifikasi di kode).
- [ ] **Pustaka Kolaboratif (Shared Curriculums)**: Pengguna dapat membagikan silabus belajar dan daftar rujukan pustaka mereka ke publik untuk dipelajari bersama.
- [ ] **API Penerbitan Pihak Ketiga**: Integrasi ekspor tulisan langsung ke platform penerbitan mandiri seperti Ghost, Medium, atau repositori tulisan personal via Webhooks.

---

## 7.2 Riwayat Perubahan (Changelog)

### v1.1.4-beta (September 2026)
* **Penyelesaian Komprehensif Kegagalan AI Gateway & Resiliensi Multi-Tier**:
  - **Fast-Fail & Alokasi Timeout Per-Tier**: Memperbaiki alokasi batas waktu `executeAIRequest` di `server.ts`. Mengimplementasikan deteksi pemutusan dini (*fast-fail*) pada gateway HCNSEC ketika model mengalami *abort* atau jaringan tidak merespons, mencegah pemborosan waktu tunggu berulang dan langsung mengalihkan komputasi secara mulus ke Tier 2 (OpenRouter) dan Tier 3 (Gemini SDK).
  - **Reparasi Otomatis JSON Terpotong (`repairTruncatedJson`)**: Menambahkan algoritma penutupan string, eliminasi kunci menggantung, dan penyeimbangan kurung kurawal/siku LIFO pada `server.ts` untuk memulihkan respon JSON model yang terpotong prematur oleh batas token.
  - **Pencegahan Error 503 Lonjakan Beban Gemini**: Menambahkan penanganan jeda adaptif dan rotasi model otomatis (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`) saat menghadapi status lonjakan beban 503 UNAVAILABLE.
  - **Pengamanan Unhandled Promise Rejection**: Menambahkan pengaman `process.on('unhandledRejection')` dan penanganan `.catch()` pada `aiPromise` di `server.ts` guna mencegah pembatalan tak tertangani saat `Promise.race` telah selesai terlebih dahulu.
  - **Optimalisasi Silabus & Penanganan Respon UI**: Meningkatkan alokasi `maxTokens` silabus menjadi 3500 token dengan panduan instruksi kompetensi terfokus pada `server.ts`, serta memperkuat penanganan kesalahan dan ekstraksi status respon di `src/modules/curriculum/CurriculumPage.tsx`.

### v1.1.3-beta (September 2026)
* **Optimasi Pemisahan Berkas (Bundle Chunk Splitting)**:
  - Mengonfigurasi `manualChunks` di `vite.config.ts` untuk memecah pustaka vendor besar (`@xenova/transformers`, `onnxruntime-web`, `d3`, `recharts`, `firebase`, `katex`, `react-core`) ke dalam berkas chunk terpisah, mengoptimalkan waktu muat awal aplikasi dan pemanfaatan cache peramban.
* **Dukungan Formula KaTeX & Notasi Ilmiah**:
  - Mengintegrasikan pustaka `remark-math`, `rehype-katex`, dan `katex` ke dalam komponen modular `MarkdownRenderer` (`src/components/ui/MarkdownRenderer.tsx`), serta mengimpor stylesheet KaTeX di `src/main.tsx`.
  - Menerapkan rendering LaTeX di catatan hierarkis (`NoteDetailPage.tsx`), latihan flashcard SM-2 (`ReviewSessionPage.tsx`), dialog asisten AI (`AIAssistantDialog.tsx`), dan pratinjau graf pengetahuan (`KnowledgeGraphPage.tsx`).
* **Aktivasi Antarmuka Sinkronisasi Cloud Firestore**:
  - Menghadirkan fungsi `syncAllLocalToCloud` di `src/lib/firestoreSync.ts` untuk menyelaraskan seluruh entitas data lokal ke Firestore.
  - Menambahkan panel kontrol sinkronisasi awan terdedikasi di `SettingsPage.tsx` lengkap dengan indikator status Firebase, otentikasi Google, dan pemicu sinkronisasi manual berestetika monokrom slate.

### v1.1.2-beta (September 2026)
* **Keandalan Eksekusi AI (AI Gateway Reliability)**:
  - **Kalkulasi Timeout Dinamis**: Penerapan batas waktu dinamis pada level per-model untuk provider HCNSEC dan OpenRouter (`remainingTime * 0.9`), mencegah jeda mati yang panjang sekaligus mengoptimalkan sisa alokasi waktu pemrosesan.
  - **Peningkatan Batas Waktu Global (Global Timeout Extension)**: Memperpanjang batas waktu generasi untuk rute berat seperti `/api/ai/generate-syllabus` (90 detik) dan `/api/ai/generate-flashcards` (80 detik) guna mengakomodasi proses sintesis yang lama tanpa interupsi *HTTP 500*.
  - **Validasi Integritas JSON Internal**: Menambahkan filter pra-pengiriman (`cleanAndParseJson`) langsung di dalam antrean model failover. Apabila model AI mengembalikan format JSON yang rusak/terpotong (*truncated*), sistem secara otomatis menolak dan memanggil model cadangan di lapis berikutnya.
* **Lapisan Notifikasi Global (Global Error Boundary & Toaster)**:
  - Mengimplementasikan `ErrorBoundary` level atas di `main.tsx` untuk menangkap kerusakan (*crash*) komponen antarmuka, menyajikan layar pemulihan ramah-pengguna yang menampakkan detail *stack trace* kode.
  - Mengintegrasikan pencegat kejadian global (`window.onerror`, `window.unhandledrejection`) dipadukan dengan notifikasi pustaka `sonner`. Setiap kesalahan *runtime* atau API yang gagal (termasuk kegagalan timeout AI) kini akan langsung muncul sebagai *toast popup* peringatan dengan jejak pelacakan (trace), meminimalisir proses penelusuran masalah (debugging) yang bersembunyi di konsol peramban.

### v1.1.1-beta (September 2026)
* **Ekspor Literer Studio Menulis**:
  - Menyediakan menu aksi dropdown "Ekspor" di bilah atas `WritingDetailPage.tsx`.
  - Opsi *Salin Markdown*: Menghasilkan teks Markdown lengkap dengan Frontmatter YAML (`title`, `status`, `tags`, `words`, `created`, `updated`) ke papan klip (*clipboard*).
  - Opsi *Unduh Berkas (.md)*: Mengunduh draf tulisan secara instan ke sistem berkas lokal via Blob dan library `file-saver`.
  - Opsi *Cetak / Simpan PDF*: Memanfaatkan fitur cetak browser asli dengan lembar gaya `@media print` khusus (`src/index.css`) yang menyembunyikan navigasi, bilah sisi, tombol aksi, dan dialog, serta memformat tipografi esai secara bersih dan elegan.
* **Audit & Standarisasi Pintu Gerbang AI (AI Client Gateway Audit)**:
  - Menstandarkan 100% pemanggilan endpoint API kecerdasan buatan (`/api/ai/*`) di seluruh modul aplikasi (`NotesPage.tsx`, `NoteDetailPage.tsx`, `WritingDetailPage.tsx`, `LibraryPage.tsx`, `BookDetailPage.tsx`, `ConceptsPage.tsx`, `ReviewSessionPage.tsx`, `CurriculumPage.tsx`) untuk memakai utilitas `fetchWithAuth`.
  - Memperbaiki penanganan otentikasi dan kegagalan panggilan jaringan secara terpusat dengan notifikasi `toast` interaktif.
  - Memastikan teks penafian epistemik *"Hasil AI — periksa ke sumber sebelum dijadikan pegangan."* hadir pada seluruh komponen keluaran AI (`WritingDetailPage.tsx`, `AddNoteDialog.tsx`, `AIAssistantDialog.tsx`, `BookDetailPage.tsx`, `ConceptsPage.tsx`, `ReviewSessionPage.tsx`, `CurriculumPage.tsx`).
  - Mengganti dialog primitif `alert()` pada `NoteDetailPage.tsx` dengan komponen notifikasi `toast` sistem.

### v1.1.0-beta (September 2026)
* **Penyempurnaan Lapisan Ta'dib & Integritas Epistemik AI**:
  - **Integritas Provenance Relasi**: Mengoreksi pembuatan relasi oleh `autoLinker.ts` agar relasi yang dihasilkan AI (`createdBy: 'ai_agent'`) memiliki `verifiedBySystem: false` secara jujur tanpa rekayasa flag.
  - **Penyematan ProvenanceBadge & Aksi 1-Ketuk**: Menyematkan komponen `ProvenanceBadge` di kartu konsep (`ConceptsPage.tsx`) dan catatan (`NoteDetailPage.tsx`) dengan kemampuan verifikasi instan satu-sentuhan tanpa hambatan modal dialog.
  - **Pembedaan Visual Graf Pengetahuan**: Sisi (*edge*) relasi AI yang belum diverifikasi digambar dengan garis putus-putus (*dashed line*) dan opasitas yang diturunkan secara proporsional sesuai skor keyakinan (*confidence score*) di graf D3.js (`KnowledgeGraphPage.tsx`).
  - **Disclaimer Epistemik Standar**: Menyematkan teks baku *"Hasil AI — periksa ke sumber sebelum dijadikan pegangan."* pada seluruh permukaan keluaran AI (`CurriculumPage.tsx`, `ReviewSessionPage.tsx`, `ConceptsPage.tsx`, `NoteDetailPage.tsx`, `BookDetailPage.tsx`, `LibraryPage.tsx`, `AIAssistantDialog.tsx`).
  - **Penyaringan Konsep Terverifikasi**: Menambahkan kontrol filter "Hanya Terverifikasi Manual" di halaman Manajemen Konsep.

### v1.0.0-beta (Agustus 2026)
* **Kreator & Identitas Resmi**:
  - Dikelola oleh **egiistw88** dengan identitas resmi *Madrasah — Personal Knowledge OS*.
  - Penyajian modal informasi sistem terpadu (**AboutDialog**) dengan metadata versi, kreator, dan kutipan filosofis.
* **Mesin Penautan Otomatis (Automated Entity & Knowledge Linking Engine)**:
  - Deteksi entitas waktu nyata (*live contextual detection*) di **Studio Menulis** dengan kemampuan penyisipan `[[WikiLink]]` satu sentuhan.
  - Penautan otomatis konsep, buku rujukan, dan catatan saat pembuatan/penyuntingan proyek, draf tulisan, dan kurikulum belajar.
  - Tampilan indikator badge relasi (*relation count badges*) dan panel penelusuran relasi pengetahuan interaktif pada halaman detail.
* **Penyempurnaan Ergonomi Mobile-First & Kesetaraan Fitur Lintas Tampilan (Desktop & Mobile Parity)**:
  - Sinkronisasi penuh laci navigasi mobile (`MobileNav`): penambahan daftar lengkap seluruh 9 modul kerja, daftar item terkini (*Recent Notes & Drafts*), pemicu panduan pintasan (`ShortcutGuide`), informasi sistem (`AboutDialog`), dan tombol keluar (*Logout*).
  - Standarisasi area sentuh minimal **44px** (`min-h-[44px]`) untuk seluruh elemen kontrol sentuh pada layar ponsel.
  - Penambahan bilah pencarian instan pada tampilan mobile modul **Catatan** (`NotesPage`) tanpa perlu membuka akordeon filter folder terlebih dahulu.
  - Penyesuaian koordinat penumpukan (*z-index*) dan letak panel inspektur pada modul **Graf Pengetahuan** (`KnowledgeGraphPage`) agar berada tepat di atas bilah navigasi bawah tanpa menghalangi aksi interaksi.
  - Mengisolasi tingkatan penumpukan z-index dialog modal pada **`z-[100]`** dengan latar belakang redup (*backdrop blur*), mencegah konflik interaksi dengan bilah navigasi bawah (`MobileNav`).
  - Menambahkan *snap-scroll* pada papan Kanban modul **Alur Menulis** untuk transisi kolom yang alami di layar ponsel.
* **Integrasi Gateway AI HCNSEC**:
  - Mengadopsi provider **HCNSEC** (`HCNSEC_API_KEY`, `HCNSEC_BASE_URL`, `HCNSEC_MODEL`) sebagai jalur utama komunikasi kecerdasan buatan dengan kompatibilitas protokol OpenAI Chat Completions.
  - Memperbarui mekanisme caching respons AI (TTL 1 jam) dan sanitasi parsing JSON robust.
* **Penyempurnaan Modul Konsep & Pustaka**:
  - Integrasi pencarian cover dan metadata buku otomatis melalui OpenLibrary API (`/api/ai/book-info`) dengan strategi pencarian berjenjang (judul + penulis, lalu fallback judul saja), ekstraksi nama penulis, serta alur fallback AI yang andal (`gemini-3.8-flash`, batas `max_tokens`, dan batas waktu responsif).
  - Penambahan modul Konsep untuk pelacakan unit pengetahuan abstrak dan bukti asal-usul (*provenance*).
* **Standardisasi Dokumentasi Teknis Profesional**:
  - Sinkronisasi menyeluruh seluruh dokumen di `/docs/` sebagai *Single Source of Truth*.

### v0.9.0-alpha (Juli 2026)
* **Penyempurnaan Estetika Visual (Monochrome Overhaul)**:
  - Melakukan pembersihan menyeluruh terhadap palet warna sekunder di seluruh modul menuju skema monokromatik hitam-putih-slate murni (Maksimal 3 warna).
  - Menghapus tombol melayang "Quick Add" untuk memastikan kejernihan ruang visual.
* **Pembersihan Infrastruktur & Bundler**:
  - Mengonfigurasi bundler esbuild untuk mengompilasi berkas `server.ts` menjadi berkas CommonJS tunggal (`dist/server.cjs`) guna menyelesaikan isu kebergantungan relatif ESM di lingkungan Cloud Run.
* **Overhaul Dokumentasi**:
  - Menyusun ulang seluruh sistem dokumentasi ke dalam struktur direktori `/docs` modular.

### v0.1.0-alpha (Juni 2026)
* **Peluncuran Madrasah Personal Knowledge Operating System**:
  - Rilis awal dasbor Mission Control terintegrasi Hijri Clock.
  - Rilis modul Zettelkasten Catatan, Pustaka Literatur, Kurikulum Pembelajaran, Proyek Aktif, dan Studio Menulis.
  - Rilis visualisasi Knowledge Graph berbasis D3.js.
  - Integrasi AI Syllabus Planner, AI Tag recommender, AI Flashcard Generator, dan SM-2 Spaced Repetition.
