# 10. PRD — Lapisan Ta'dib: Provenance & Kejujuran Epistemik AI

Dokumen ini menggantikan 10_tadib_layer_prd.pdf (draft). Isinya sama, dengan status dan §12 diperbarui sesuai keputusan yang sudah diambil, dan FR3 dipertegas agar konsisten dengan prinsip Gesekan Minimal di `docs/01`.

| Atribut | Nilai |
| :--- | :--- |
| **Jenis Dokumen** | Product Requirements Document (PRD) — fitur tambahan |
| **Cakupan** | Ditambahkan di atas Madrasah v1.2.5-beta yang sudah shipped. Bukan pivot produk, bukan rebrand, bukan penulisan ulang filosofi. |
| **Prasyarat baca** | `docs/01_identity_and_philosophy.md`, `docs/03_architecture_and_project_structure.md`, `docs/05_data_model_and_api.md` |
| **Status** | Final — Fase 0 & 1 disetujui untuk eksekusi. Fase 2 menunggu checkpoint pemakaian 2 minggu setelah Fase 1 berjalan. Fase 3 wajib sebelum peluncuran multi-user, belum mulai. |

## 1. Latar Belakang

Filosofi ta'dib (kerangka al-Attas: AI sebagai instrumen bukan otoritas, kesadaran batas epistemologis mesin) sudah matang di level konsep, tapi belum menyentuh kode. Produk yang sudah live justru sudah punya fondasi teknis yang nyaris tepat untuk itu, tapi belum diaktifkan dan sebagiannya diberi nilai default yang menyesatkan:

- `SourceFragment.reliabilityScore` (`src/types/index.ts`) — ada di skema, tapi tidak pernah dibaca atau ditampilkan di UI mana pun.
- `Relation.confidenceScore`, `createdBy`, `verifiedBySystem` (`src/types/index.ts`) — ada, tapi di `src/utils/autoLinker.ts` (baris ~336 dan ~495) setiap relasi buatan AI diberi `confidenceScore: 0.95` dan `verifiedBySystem: true` secara hardcode, tanpa mencerminkan keyakinan aktual model. Klaim "diverifikasi sistem" saat ini bohong secara teknis.

PRD ini tidak meminta membangun sesuatu dari nol. Ia meminta menyalakan dan meluruskan sesuatu yang sudah ada tapi rusak secara diam-diam.

## 2. Tujuan (Goals)

- **G1**. Setiap konten buatan AI (relasi, tag, flashcard, ringkasan silabus) dapat dibedakan secara visual dari konten yang sudah dikonfirmasi manual oleh pengguna.
- **G2**. `confidenceScore` dan `verifiedBySystem` mencerminkan kondisi nyata, bukan nilai default yang dipalsukan.
- **G3**. Pengguna punya mekanisme eksplisit untuk menandai catatan pada domain sensitif (akidah, fiqih, tasawuf) sebagai "perlu verifikasi manual" sebelum dianggap *settled knowledge*.
- **G4**. Setiap permukaan AI-generation (Syllabus Planner, Flashcard Generator, Grading Assistant, Auto-Linker) menampilkan disclaimer konsisten di titik kemunculannya, bukan hanya di FAQ.

## 3. Non-Tujuan (Non-Goals) — batas tegas

- **Bukan mesin fatwa**. Fitur ini tidak pernah menghasilkan, menilai benar-salah, atau merangking pendapat keagamaan.
- **Bukan kurikulum kalam/ushul fiqh/tasawuf bawaan**. Konten Islam sebagai isi default adalah keputusan terpisah dengan konsekuensi jauh lebih besar (lihat §9) — di luar cakupan PRD ini.
- **Bukan fitur sosial/komunitas** (guru-murid, diskusi publik, sanad digital antar-pengguna). Madrasah tetap single-user/personal pada fase ini.
- **Bukan rebranding produk**. `docs/01` tidak ditulis ulang — hanya ditambah satu bagian baru (§1.6).
- **Bukan alasan menambah langkah interaksi baru** di luar satu titik yang disebutkan di FR3. Lihat prinsip Gesekan Minimal di `docs/01` §1.4.

## 4. Masalah yang Diselesaikan

Pengguna (Anda sendiri, dan siapa pun yang memakai instance ini nanti) tidak punya cara membedakan "saya menyimpulkan ini sendiri dari sumber yang saya percaya" dari "AI menebak koneksi ini dengan confidence yang tidak pernah saya lihat angkanya." Knowledge graph yang tumbuh dari `autoLinker.ts` bisa terlihat solid secara visual padahal isinya tebakan berlabel "verified" secara keliru — alat yang seharusnya melatih kejernihan berpikir malah diam-diam menanamkan rasa percaya diri yang tidak berdasar.

## 5. User Stories

1. Sebagai pengguna, saat membuka Note atau Concept, saya ingin melihat badge yang membedakan relasi manual vs buatan AI lengkap dengan angka keyakinannya — agar saya tidak memperlakukan tebakan mesin sebagai fakta mapan.
2. Sebagai pengguna, saat menyimpan `SourceFragment` dari topik sensitif, saya ingin mengisi `reliabilityScore` secara sadar sebelum bisa dikutip di tempat lain.
3. Sebagai pengguna, saat AI Syllabus Planner atau Flashcard Generator menghasilkan output, saya ingin melihat label "dihasilkan AI — belum diverifikasi" langsung di kartu/output-nya.
4. Sebagai pengguna, saya ingin menandai satu Note/Concept sebagai domain sensitif, dan begitu ditandai, auto-linker tidak boleh menempelkan `verifiedBySystem: true` padanya tanpa konfirmasi saya.

## 6. Requirement Fungsional

- **FR1 — Perbaiki default yang menyesatkan** (prasyarat semua fitur di bawah). Di `autoLinker.ts`, hapus hardcode `verifiedBySystem: true` untuk relasi `createdBy: 'ai_agent'`. Default yang benar: `verifiedBySystem: false` sampai pengguna mengonfirmasi. Hanya relasi `createdBy: 'user'` yang boleh default `true`.
- **FR2 — Komponen `ProvenanceBadge`**. Sesuai sistem desain monokrom di `docs/02` (maks. 3 warna, tanpa ornamen). State: *Manual* (dibuat pengguna), *AI · belum diverifikasi* (`confidence < 1`, `verifiedBySystem: false`), atau *AI · dikonfirmasi* (setelah konfirmasi). Dipasang di: `NoteDetailPage`, `ConceptsPage`, node detail di `KnowledgeGraphPage`, kartu hasil Auto-Linker.
- **FR3 — Aksi "Konfirmasi" eksplisit, satu ketukan**. Satu tombol yang mengubah `verifiedBySystem` dari `false` ke `true` hanya lewat aksi sadar pengguna — **satu tap inline di badge itu sendiri, tanpa dialog, tanpa formulir, tanpa kolom teks tambahan**. Tidak pernah otomatis untuk relasi ber-`createdBy: 'ai_agent'`. (Ditegaskan setelah diskusi lanjutan: aksi ini harus terasa seringan menekan status "Selesai" pada progress buku — bukan langkah tambahan yang terasa sebagai beban.)
- **FR4 — Field domain epistemik** (opsional, per-item). Tambahkan `epistemicDomain?: 'umum' | 'akidah' | 'fiqih' | 'tasawuf' | 'sejarah'` pada `Note` dan `Concept`. Jika diisi selain `'umum'`, auto-linker tidak boleh menempelkan relasi baru dengan `verifiedBySystem: true` — selalu `false` menunggu FR3.
- **FR5 — Disclaimer di titik kemunculan, bukan hanya FAQ**. Setiap output AI Copilot menampilkan satu baris kecil konsisten: "Hasil AI — periksa ke sumber sebelum dijadikan pegangan." Harus muncul di komponen output itu sendiri.

## 7. Perubahan Data Model

Minimal, di atas skema yang sudah ada di `src/types/index.ts` (lihat `docs/05` §5.5):

```typescript
// Note dan Concept: tambahkan satu field opsional
epistemicDomain?: 'umum' | 'akidah' | 'fiqih' | 'tasawuf' | 'sejarah';

// Tidak ada perubahan struktur pada Relation atau SourceFragment —
// confidenceScore, verifiedBySystem, reliabilityScore sudah cukup.
```

// Yang berubah adalah DI MANA dan KAPAN nilai-nilai itu diisi (lihat FR1).

**Migrasi**: `dataMigration.ts` perlu backfill — set `false` untuk semua relasi lama ber-`createdBy: 'ai_agent'` yang belum pernah disentuh pengguna secara eksplisit. Tidak ada cara mengetahui ini dari data yang ada, jadi pendekatan paling jujur adalah menganggap semua relasi AI lama sebagai belum diverifikasi, lalu biarkan pengguna mengonfirmasi ulang secara bertahap.

## 8. Perilaku UI per Layar

| Layar | Perubahan |
| :--- | :--- |
| `NoteDetailPage.tsx` | `ProvenanceBadge` di header note; jika `epistemicDomain` bukan `umum`, indikator tambahan halus (tetap monokrom, bukan warning mencolok). |
| `ConceptsPage.tsx` | Badge yang sama di kartu konsep; filter opsional "tampilkan hanya yang terverifikasi manual". |
| `KnowledgeGraphPage.tsx` | Ketebalan/opacity garis edge merepresentasikan `confidenceScore` — edge dari relasi AI yang belum dikonfirmasi tampil lebih tipis/pudar. |
| Output AI Copilot (Syllabus/Flashcard/Grading) | Baris disclaimer FR5 + badge status di setiap kartu output. |

## 9. Batas Tegas: Ini Bukan Otoritas Keagamaan

Sudah ditulis eksplisit di `docs/01` §1.6 (bagian baru, bukan mengganti yang lama): Madrasah tidak pernah menjadi sumber kebenaran agama. Field `epistemicDomain` dan skor kepercayaan hanya alat bantu pengguna melacak keyakinannya sendiri terhadap catatannya sendiri — bukan penilaian sahih-tidaknya suatu pendapat keagamaan.

## 10. Metrik Keberhasilan

Alat personal, metrik kualitatif:
- Bisa melacak asal sebuah klaim di knowledge graph dalam ≤3 klik dari mana pun ia muncul.
- Tidak ada lagi relasi buatan AI berlabel "terverifikasi" tanpa pernah benar-benar ditinjau.
- Setelah 2 minggu pemakaian, bisa menyebut berapa persen catatan domain sensitif yang sudah terverifikasi manual vs masih menunggu.

## 11. Fase Rilis

- **Fase 0** (secepatnya, tanpa fitur baru): FR1 saja. Bug integritas data. **Disetujui, belum dieksekusi di kode.**
- **Fase 1**: FR2 + FR3. Mengaktifkan field yang sudah ada. **Disetujui, menunggu Fase 0.**
- **Fase 2**: FR4 + FR5. **Menunggu checkpoint 2 minggu setelah Fase 1 berjalan** — belum tentu langsung dikerjakan.
- **Fase 3** (di luar PRD ini): jika suatu saat konten kalam/ushul fiqh/tasawuf bawaan disediakan (bukan cuma catatan pribadi), butuh jalur validasi ulama sesungguhnya. **Gerbang wajib sebelum multi-user** — lihat §12.

## 12. Keputusan yang Sudah Diambil

(Sebelumnya "Pertanyaan Terbuka" di draft PDF — sudah dijawab.)

1. **Taksonomi `epistemicDomain`**: dikunci pada 4 kategori — `umum`, `akidah`, `fiqih`, `tasawuf`, `sejarah`. Tidak diperluas untuk saat ini.
2. **Fase 2 sekarang atau nanti**: Fase 0–1 dulu, dengan checkpoint 2 minggu untuk melihat apakah kebiasaan verifikasi manual benar-benar dipakai, sebelum memutuskan Fase 2.
3. **Single-user selamanya atau tidak**: Dikonfirmasi — Madrasah dibayangkan suatu saat dipakai orang lain. Ini mengubah bobot §9 secara total dan menjadikan Fase 3 (jalur validasi ulama) sebagai gerbang wajib, bukan opsional, sebelum peluncuran multi-user kapan pun itu terjadi.
