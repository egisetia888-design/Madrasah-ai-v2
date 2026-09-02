# 🤝 09. Panduan Kontribusi Pengembang (Contribution Guidelines)

Kami menyambut baik kontribusi dari komunitas pengembang, desainer, akademisi, dan pengguna untuk bersama-sama menjadikan **Madrasah — Personal Knowledge Operating System** sebagai sistem operasi pengetahuan terbaik.

---

## 9.1 Siklus Kontribusi Kode (Developer Workflow)

Untuk menjaga kualitas dan keandalan sistem operasi pengetahuan ini, setiap kontribusi kode wajib mengikuti alur kerja terstruktur berikut:

```
[Fork Repositori] ---> [Buat Branch Fitur] ---> [Tulis Kode & Lakukan Tes]
                                                          |
                                                          v
[Kirim Pull Request] <-- [Jalankan Linter & Build] <-- [Komit Perubahan]
```

1. **Fork & Clone**: Lakukan fork terhadap repositori resmi Madrasah ke akun pribadi Anda, lalu unduh sumber kode tersebut ke mesin lokal Anda.
2. **Buat Cabang Kerja (Branching)**: Jangan pernah menulis kode langsung di cabang `main`. Buat cabang baru dari cabang `main` dengan format nama yang deskriptif:
   - Untuk fitur baru: `feature/nama-fitur` (contoh: `feature/export-to-pdf`)
   - Untuk perbaikan bug: `bugfix/deskripsi-error` (contoh: `bugfix/hijri-clock-timezone`)
   - Untuk dokumentasi: `docs/nama-dokumen`
3. **Patuhi Aturan Desain**: Selalu rujuk berkas `AGENTS.md` dan `docs/02_design_and_ux.md` sebelum mendesain komponen baru. Pastikan komponen baru mengimplementasikan prinsip monokrom hitam-putih dan menggunakan set ikon `@lucide-react`.
4. **Verifikasi Mandiri**: Sebelum melakukan komit, Anda wajib menjalankan verifikasi linter lokal dan pembangunan produksi untuk mendeteksi kesalahan kompilasi sedini mungkin (lihat Bagian 9.3).
5. **Kirim Pull Request (PR)**: Setelah kode Anda terdorong ke repositori fork Anda, ajukan Pull Request ke cabang `main` repositori resmi dengan menuliskan deskripsi perubahan yang jelas dan komprehensif.

---

## 9.2 Konvensi Pesan Komit (Commit Message Conventions)

Kami menerapkan standar pesan komit berbasis **Conventional Commits** untuk memudahkan otomatisasi changelog dan pelacakan riwayat perubahan:

Format dasar: `<tipe>(<lingkup-opsional>): <deskripsi pendek dalam bahasa Indonesia>`

### Daftar Tipe Komit yang Diizinkan:
- **`feat`**: Penambahan fitur baru ke dalam sistem (contoh: `feat(review): tambah AI flashcard generator`).
- **`fix`**: Perbaikan kesalahan atau bug (contoh: `fix(graph): perbaiki drawer detail tidak muncul di mobile`).
- **`docs`**: Perubahan atau penulisan ulang dokumen (contoh: `docs: overhaul dokumentasi resmi proyek`).
- **`style`**: Penyesuaian gaya visual, format kode, atau merapikan spasi tanpa mengubah logika kode fungsional (contoh: `style: ubah semua button rounded ke rounded-xl`).
- **`refactor`**: Restrukturisasi kode demi efisiensi tanpa mengubah fungsionalitas atau memperbaiki bug (contoh: `refactor(store): optimasi pencarian di notesStore`).
- **`chore`**: Pemeliharaan rutin paket dependensi, konfigurasi pembangun, atau berkas pendukung (contoh: `chore: perbarui versi esbuild di package.json`).

---

## 9.3 Standar Kualitas & Pemeriksaan Mandiri

Sebelum mengajukan Pull Request, kontributor wajib memastikan bahwa kode yang diajukan memenuhi tiga kriteria kualitas utama berikut:

### 1. Kepatuhan TypeScript (Zero Linter Warnings)
Jalankan linter TypeScript di lingkungan lokal Anda menggunakan perintah:
```bash
npm run lint
```
Perintah ini memicu pengecekan tipe statis (`tsc --noEmit`). Kode Anda harus lulus **100% tanpa ada pesan peringatan atau kesalahan kompilasi tipe data**.

### 2. Keberhasilan Bundling Produksi
Pastikan proses pengemasan aset frontend dan pembundelan server backend berjalan lancar dengan perintah:
```bash
npm run build
```
Proses build harus selesai dengan sukses dan menghasilkan aset terkompresi di folder `/dist`.

### 3. Kebersihan Kode & Ergonomi Mobile (Clean Code & Mobile First)
- **Aksesibilitas Mobile**: Uji setiap komponen baru pada resolusi viewport mobile (360px–420px). Pastikan target sentuh minimal 44px dan bilah tab menggunakan scrolling horisontal dengan utilitas `no-scrollbar`.
- **Hapus Console Logs**: Pastikan tidak ada sisa `console.log` pengembangan yang tertinggal di dalam komponen produksi.
- **Modularitas**: Hindari menulis seluruh logika di dalam satu berkas besar (seperti menumpuk semua kode di `App.tsx`). Pisahkan sub-komponen ke dalam berkas-berkas mandiri di dalam direktori `src/components/` atau `src/modules/` masing-masing.
- **Optimasi Impor**: Susun baris impor di bagian atas berkas secara rapi (impor pustaka eksternal diletakkan terlebih dahulu, diikuti impor modul internal proyek).
- **Pemeliharaan Dokumentasi (Documentation Hygiene)**: Setiap kali menambahkan modul atau memodifikasi rute API, perbarui berkas terkait di `/docs/` sebagai sumber kebenaran tunggal (*Single Source of Truth*).
