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

### Fase 2: Sinkronisasi Awan & Autentikasi Multi-User (Jangka Menengah)
- [ ] **Multi-User Authentication**: Integrasi Firebase Auth untuk mendukung pendaftaran dan login aman banyak pengguna secara terisolasi.
- [ ] **Durable Cloud Persistence**: Migrasi data opsional dari penyimpanan lokal (`localStorage`) ke basis data cloud terdistribusi (Firestore) untuk mencegah risiko hilangnya data akibat pembersihan cache peramban.
- [ ] **Sinkronisasi Multidevice Real-Time**: Pembaruan data instan antara sesi desktop aktif dan smartphone tanpa keterlambatan.

### Fase 3: Kolaborasi, Ekspor Literer, dan Ekosistem Penerbitan (Jangka Panjang)
- [x] **Ekspor Format Kaya**: Ekspor draf tulisan dari Studio Menulis langsung ke format Markdown lengkap dengan Frontmatter YAML, unduh berkas `.md`, serta Cetak / Simpan PDF bersih menggunakan lembar gaya cetak `@media print` tanpa chrome UI. (Selesai dan terverifikasi di kode).
- [ ] **Pustaka Kolaboratif (Shared Curriculums)**: Pengguna dapat membagikan silabus belajar dan daftar rujukan pustaka mereka ke publik untuk dipelajari bersama.
- [ ] **API Penerbitan Pihak Ketiga**: Integrasi ekspor tulisan langsung ke platform penerbitan mandiri seperti Ghost, Medium, atau repositori tulisan personal via Webhooks.

---

## 7.2 Riwayat Perubahan (Changelog)

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
* **Penyempurnaan Ergonomi Mobile-First (Mobile Web App Mastery)**:
  - Mengimplementasikan bilah tab gulir horisontal (`no-scrollbar`) dengan penanganan gestur sentuh mulus di seluruh modul (**Pustaka**, **Proyek**, **Catatan**, **Kurikulum**, **Alur Menulis**, **Review**, **Konsep**, dan **Graf Pengetahuan**).
  - Menstandarkan area sentuh minimal **44px** (`h-11`) untuk seluruh tombol aksi mobile dan input navigasi.
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
