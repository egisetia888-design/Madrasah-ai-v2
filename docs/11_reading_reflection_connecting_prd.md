# 11. PRD — Fondasi Baca, Berpikir, Refleksi, dan Menyambungkan Titik

| Atribut | Nilai |
| :--- | :--- |
| **Jenis Dokumen** | Product Requirements Document (PRD) — fitur tambahan |
| **Cakupan** | Ditambahkan di atas Madrasah v1.0.0-beta yang sudah shipped. Berbagi satu titik UI dengan `docs/10_tadib_layer_prd.md` (lihat §6, FR3 di dokumen ini menggunakan ulang FR3 di doc 10 — tidak menduplikasi). |
| **Prasyarat baca** | `docs/01_identity_and_philosophy.md` §1.4 (prinsip Gesekan Minimal), `docs/04_modules_and_features.md`, `docs/10_tadib_layer_prd.md` |
| **Status** | Final — siap masuk roadmap Fase 1.5B. |

## 1. Latar Belakang

Karena proyek ini lekat dengan aktivitas membaca buku, fitur fundamental di jalur baca → tangkap pikiran → proses → sambungkan harus benar-benar tersedia dan terintegrasi mulus — bukan sekadar filosofi di atas kertas. Inspeksi terhadap kode yang sudah shipped menunjukkan sebagian jalur ini sudah solid, sebagian lagi bolong:

- **Sudah berjalan** (`BookDetailPage.tsx`, `NotesPage.tsx`, `DashboardPage.tsx`): Buku → Quick Note (terikat `sourceId`) → entitas otomatis ter-link → catatan masuk status `unprocessed` di Inbox → Dashboard menegur jumlah catatan belum diproses → AI bantu ekstrak flashcard/saran koneksi → status `processed`.
- **Bolong**: Tidak ada ritual refleksi berkala (tidak ada journal, streak, daily/weekly review di seluruh codebase). `KnowledgeGraphPage.tsx` murni visualisasi pasif — tidak mendeteksi catatan/konsep yang belum terhubung ke apa pun, padahal itu sinyal paling berharga untuk "menyambungkan titik". Aktivitas menyambungkan saat ini nyaris seluruhnya dikerjakan `autoLinker.ts` secara otomatis, bukan dilatih ke pengguna sebagai tindakan berpikir sadar.

## 2. Tujuan (Goals)

- **G1**. Pengguna punya cara pasif (tanpa langkah tambahan) untuk melihat catatan/konsep yang belum tersambung ke apa pun, sebagai ajakan berpikir — bukan tugas wajib.
- **G2**. Catatan lama yang sudah `processed` tapi tidak disentuh dalam waktu lama dimunculkan ulang secara otomatis untuk direnungkan.
- **G3**. Tindakan "menyambungkan titik" tetap sebagian menjadi tindakan sadar pengguna, tidak 100% diambil alih otomatisasi — tanpa menambah langkah interaksi baru (lihat §3).

## 3. Non-Tujuan (Non-Goals) — batas tegas

- **Bukan fitur jurnal atau ritual harian baru**. Tidak ada halaman baru, tidak ada kewajiban menulis refleksi.
- **Bukan kolom teks tambahan di alur konfirmasi manapun**. Ide "jelaskan kenapa dua hal ini nyambung" dipertimbangkan dan ditolak — bertentangan dengan prinsip Gesekan Minimal.
- **Bukan pengaturan/toggle baru** (mis. "level otomatisasi") di Settings. Menambah keputusan baru yang harus dipikirkan pengguna bertentangan dengan tujuan kesederhanaan.
- **Bukan penggantian mekanisme SM-2 Spaced Repetition yang sudah ada**. Ini pelengkap, bukan pengganti.

## 4. Masalah yang Diselesaikan

"Fundamental" yang benar-benar lengkap bukan berarti banyak fitur — berarti jalur baca-ke-pikir tidak berhenti di tengah. Saat ini jalur berhenti setelah catatan berstatus `processed`: tidak ada yang mengundang pengguna kembali melihatnya, dan tidak ada yang menandai titik-titik yang masih berdiri sendiri di knowledge graph. Otomatisasi penuh pada auto-linking berisiko membuat pengguna pasif menonton graf tumbuh, bukan aktif berpikir menyambungkannya — persis kegagalan yang diperingatkan filosofi ta'dib di `docs/01`.

## 5. User Stories

1. Sebagai pengguna, saat membuka Dashboard, saya ingin melihat berapa catatan/konsep yang masih berdiri sendiri (0–1 relasi), tanpa harus mencarinya manual di Graf.
2. Sebagai pengguna, saya ingin sesekali diingatkan pada catatan lama yang sudah lama tidak saya lihat, tanpa harus membuka jurnal terpisah untuk itu.
3. Sebagai pengguna, saat saya mengonfirmasi sebuah relasi AI (FR3, doc 10), momen itu sudah cukup sebagai satu-satunya titik di mana saya "menyambungkan titik" secara sadar — saya tidak ingin diminta melakukan langkah tambahan di tempat lain.

## 6. Requirement Fungsional

- **FR1 — Panel "Belum Terhubung"**. Kueri pasif: notes/concepts dengan jumlah relasi 0–1. Tampil sebagai satu kartu ringkas di Dashboard (area yang sudah ada, bersebelahan dengan panel AI Copilot Insight di `DashboardPage.tsx`), murni informasi — tidak ada aksi wajib.
- **FR2 — Resurfacing Mingguan**. Catatan `processed` dengan `updatedAt` lebih lama dari N hari (nilai default disarankan: 14) dimunculkan sebagai 1–3 kartu di Dashboard, berganti tiap minggu. Sumber data: query sederhana atas `notesStore`, tidak perlu skema baru.
- **FR3 — Gunakan ulang aksi Konfirmasi, jangan buat baru**. Titik gesekan sadar yang sudah dirancang di `docs/10_tadib_layer_prd.md` FR3 (satu tap, tanpa dialog) sudah cukup sebagai satu-satunya tindakan berpikir eksplisit di seluruh alur ini. PRD ini secara sadar tidak menambah FR baru untuk "aktivitas menyambungkan" — cukup memastikan FR1 dan FR2 di atas membuat momen itu lebih sering muncul secara alami, bukan menambah langkah baru.

## 7. Perubahan Data Model

**Tidak ada.** FR1 dan FR2 murni kueri baca atas skema yang sudah ada (`Relation`, `Note`, `Concept` — lihat `docs/05` §5.5). Tidak ada field baru, tidak ada migrasi.

## 8. Perilaku UI per Layar

| Layar | Perubahan |
| :--- | :--- |
| `DashboardPage.tsx` | Satu kartu baru "Belum Terhubung" (FR1) di kolom sidebar, gaya sama dengan kartu "AI Copilot" yang sudah ada. Satu kartu resurfacing (FR2), muncul bergantian tiap minggu. Keduanya pasif — tidak ada tombol aksi wajib, hanya tautan navigasi opsional ke item terkait. |

## 9. Metrik Keberhasilan

Kualitatif, sama semangatnya dengan doc 10:
- Tidak ada catatan `processed` yang terlupakan lebih dari sebulan tanpa pernah muncul kembali ke perhatian pengguna.
- Jumlah catatan/konsep dengan 0 relasi menurun dari waktu ke waktu tanpa pernah terasa sebagai "tugas".

## 10. Fase Rilis

Digabungkan ke roadmap Fase 1.5B (`docs/07_roadmap_and_changelog.md`), berjalan paralel dengan Fase 1.5A (Lapisan Ta'dib) karena FR3 di sini bergantung pada FR3 doc 10 sudah tersedia.
