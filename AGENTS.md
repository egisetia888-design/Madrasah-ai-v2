# 🤖 Petunjuk Agen Kecerdasan Buatan (AI Agent Guidelines)

Dokumen ini berisi panduan dan aturan baku khusus untuk AI Coding Agent yang memodifikasi, menambah, atau mendesain ulang bagian apa pun dari proyek **Madrasah — Personal Knowledge Operating System**. Semua instruksi ini harus dipatuhi untuk menjaga integritas kode, estetika visual, dan responsivitas aplikasi.

---

## 🎨 1. Aturan Desain & Konsistensi UI/UX

- **Tipografi Wajib**:
  - Semua elemen tajuk/judul utama (`h1`, `h2`, `h3`, `h4`, `DialogTitle`) harus menggunakan font display **Plus Jakarta Sans** (`font-display`).
  - Elemen isi paragraf atau teks biasa wajib menggunakan font sans **Inter**.
  - Metadata, kode, atau informasi numerik wajib menggunakan **JetBrains Mono** (`font-mono`).
- **Lengkungan Elemen (Rounded Corners)**:
  - Kartu utama (`Card`), dialog box (`Dialog`), panel samping, dan laci navigasi harus menggunakan lekukan modern **rounded-2xl** (`rounded-2xl`).
  - Tombol (`Button`), input teks, textarea, dan komponen kecil menggunakan lekukan **rounded-xl** (`rounded-xl`).
- **Skema Warna Slate Minimalis**:
  - Latar belakang utama: `bg-gray-50/50`.
  - Kartu penampung: `bg-white` dengan garis batas abu-abu sangat tipis `border-gray-200` atau `border-gray-100` dan bayangan lembut `shadow-sm`.
  - Warna primer teks: `text-gray-900`.
  - Warna sekunder teks: `text-gray-500` atau `text-gray-600`.
- **Set Ikon Tunggal**:
  - **Hanya** gunakan ikon dari pustaka `@lucide-react`. Jangan mencampuradukkan dengan ikon khusus bertipe SVG mentah atau ikon eksternal lainnya agar keseragaman visual tetap terjaga.

---

## 📱 2. Standar Responsivitas & Desain Lintas Perangkat

- **Aksesibilitas Mobile**:
  - Pastikan setiap tombol dan tautan yang dapat disentuh pada perangkat seluler memiliki tinggi area sentuh minimal **44px** atau setara dengan `h-11 md:h-9` untuk tombol default.
- **Lapisan Penumpukan (Z-Index Hierarchy)**:
  - Navigasi mobile (`MobileNav`) menggunakan posisi menempel pada bagian bawah dengan z-index `z-40` atau `z-50`.
  - Komponen dialog modal (`Dialog`) wajib ditempatkan pada z-index **z-[100]** agar dapat tampil penuh dan bebas interaksi tanpa terhalang atau terpotong oleh bilah navigasi mobile.
- **Penyaringan Pintar**:
  - Untuk modul yang memiliki panel samping pencarian dan filter (seperti halaman **NotesPage**), selalu sediakan alternatif pemicu filter mobile berbentuk tombol ringkas untuk menyembunyikan/menampilkan filter, mencegah tata letak kolom yang sempit di layar mobile.

---

## 💻 3. Aturan Kode & Penanganan State

- **Zustand Store**:
  - Seluruh status global dikelola melalui Zustand di dalam direktori `src/store/`. Pastikan tidak merekayasa status global secara lokal di dalam komponen jika modul tersebut memengaruhi data modul lainnya.
- **Lazy Initialization & Penanganan Error**:
  - Pastikan inisialisasi SDK pihak ketiga atau pemanggilan Gemini API ditangani secara dinamis dengan penanganan error yang anggun (`try-catch`), serta menyediakan fallback visual (seperti animasi memuat atau pesan peringatan yang ramah) kepada pengguna ketika koneksi atau API Key bermasalah.
- **TypeScript Strictness**:
  - Selalu deklarasikan tipe data dengan jelas. Hindari penggunaan tipe data implisit `any` atau `never` yang dapat memicu kegagalan build pada proses linter (`npm run lint`).

---

## 📚 4. Pemeliharaan Dokumentasi Resmi (Documentation Hygiene)

- **Single Source of Truth**:
  - Seluruh dokumentasi proyek tersimpan secara modular di dalam direktori `/docs/`. Jika Anda menambah, mengubah, atau menghapus modul fungsional atau skema API, Anda **wajib** memperbarui berkas terkait di `/docs/` agar dokumentasi tetap akurat merepresentasikan kode aktual.
  - Jangan biarkan dokumentasi menjadi usang. Setiap Pull Request atau perubahan kode yang signifikan harus disertai dengan pembaruan dokumentasi yang relevan di `/docs/`.

---

*Setiap perubahan kode yang Anda lakukan harus berkontribusi pada kesederhanaan, keindahan, dan keandalan sistem operasi pengetahuan pribadi ini.*
